const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
// Manually load .env from parent directory
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const AUDIT_CHANNEL_ID = process.env.DISCORD_AUDIT_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.DISCORD_LOG_CHANNEL_ID;

if (!TOKEN || !AUDIT_CHANNEL_ID) {
    console.error("❌ Missing DISCORD_BOT_TOKEN or DISCORD_AUDIT_CHANNEL_ID in .env");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

// Path to log files
const AUDIT_LOG_FILE = path.join(__dirname, "..", "logs", "audit.log");
const RAW_LOG_FILE = path.join(__dirname, "..", "logs", "system.log");


// 🗄️ Database Explorer
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

// Register Slash Command
client.once("ready", async () => {
    console.log(`✅ Audit Bot (JS) Online as ${client.user.tag}`);
    console.log(`📡 Watching Audit Log: ${AUDIT_LOG_FILE}`);
    console.log(`📡 Watching Raw Log: ${RAW_LOG_FILE}`);

    // Register /database command
    const commands = [
        {
            name: 'database',
            description: 'Explore the database (Read-Only)',
        },
    ];

    const GUILD_ID = process.env.DISCORD_GUILD_ID;

    if (GUILD_ID) {
        try {
            console.log(`Registering slash commands for Guild: ${GUILD_ID}...`);
            await client.application.commands.set(commands, GUILD_ID);
            console.log('✅ Slash commands registered for guild!');
        } catch (error) {
            console.error('❌ Error registering commands for guild:', error);
        }
    } else {
        console.warn('⚠️ DISCORD_GUILD_ID not set in .env. Slash commands will NOT be registered.');
    }

    startWatching(AUDIT_LOG_FILE, 'audit');
    startWatching(RAW_LOG_FILE, 'raw');
});

// Models to expose
const ALLOWED_MODELS = [
    'D_tbluser',
    'D_tblaudit_log',
    'D_tbltime_log',
    'D_tbldepartment',
    'D_tblposition',
    'D_tblrole',
    'D_tblteam',
    'D_tblclock_log',
    'D_tblbreak_log',
    'D_tblotp_log',
    'D_tblaccount_recovery_incident'
];

client.on('interactionCreate', async interaction => {
    try {
        // Enforce Guild Restriction
        if (process.env.DISCORD_GUILD_ID && interaction.guildId !== process.env.DISCORD_GUILD_ID) {
            if (interaction.isRepliable()) {
                await interaction.reply({ content: '🚫 This command is not available in this server.', ephemeral: true });
            }
            return;
        }

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'database') {
                await showTableSelection(interaction, false);
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'db_table_select') {
                const tableName = interaction.values[0];
                await handleTableView(interaction, tableName, 0);
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('db::')) {
                const parts = interaction.customId.split('::');
                const action = parts[1];

                if (action === 'switch') {
                    await showTableSelection(interaction, true);
                    return;
                }

                const tableName = parts[2];
                const pageStr = parts[3];
                const page = parseInt(pageStr, 10);
                await handleTableView(interaction, tableName, page);
            }
        }
    } catch (error) {
        console.error('Interaction error:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
        }
    }
});

// 🛡️ Prevent Crash on Error
client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

async function showTableSelection(interaction, isUpdate) {
    const select = new StringSelectMenuBuilder()
        .setCustomId('db_table_select')
        .setPlaceholder('Select a table to explore')
        .addOptions(
            ALLOWED_MODELS.map(model =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(model)
                    .setValue(model)
                    .setDescription(`View records from ${model}`)
            )
        );

    const row = new ActionRowBuilder().addComponents(select);

    const data = {
        content: '🗄️ **Database Explorer**\nSelect a table below to view its records.',
        components: [row],
        embeds: [] // Clear any previous embeds
    };

    if (isUpdate) {
        await interaction.update(data);
    } else {
        await interaction.reply(data);
    }
}

async function handleTableView(interaction, tableName, page) {
    const REC_PER_PAGE = 1; // 1 Record per page for "Card View" style

    // @ts-ignore
    const model = prisma[tableName]; // Dynamic access

    if (!model) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `❌ Model ${tableName} not found via Prisma.`, ephemeral: true });
        }
        return;
    }

    try {
        const count = await model.count();
        const totalPages = Math.ceil(count / REC_PER_PAGE);

        // Clamp page
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;

        // Handle empty table case
        if (count === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`🗄️ Table: ${tableName}`)
                .setDescription(`No records found.`)
                .setColor(THEME.colors.info)
                .setTimestamp();

            // Add back button even for empty tables
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('db::switch')
                        .setLabel('Switch Table')
                        .setStyle(ButtonStyle.Secondary)
                );

            const responseData = { embeds: [embed], components: [buttons] };
            if (interaction.isStringSelectMenu() || interaction.isButton()) {
                await interaction.update(responseData);
            } else {
                await interaction.reply(responseData);
            }
            return;
        }

        const data = await model.findMany({
            take: REC_PER_PAGE,
            skip: page * REC_PER_PAGE,
        });

        const record = data[0]; // Since we are showing 1 record per page for cleaner UI

        const embed = new EmbedBuilder()
            .setTitle(`🗄️ ${tableName}`)
            .setDescription(`**Record #${(page * REC_PER_PAGE) + 1}** of ${count} (Page ${page + 1}/${totalPages})`)
            .setColor(THEME.colors.info)
            .setFooter({ text: 'OrasSync Database Explorer' })
            .setTimestamp();

        // Format fields nicely
        for (const [k, v] of Object.entries(record)) {
            let val = v;
            if (val instanceof Date) val = val.toLocaleString(); // Better date format
            if (val === null) val = '*null*';

            let strVal = String(val);
            // If value is very long, truncate or put in a separate field? 
            // Let's standard truncate for inline feel
            if (strVal.length > 200) strVal = strVal.substring(0, 197) + '...';

            embed.addFields({
                name: k,
                value: strVal,
                inline: true // Grid layout
            });
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`db::prev::${tableName}::${page - 1}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('db::switch')
                    .setLabel('Switch Table')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`db::next::${tableName}::${page + 1}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1)
            );

        const responseData = {
            content: '',
            embeds: [embed],
            components: [buttons]
        };

        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await interaction.update(responseData);
        } else {
            await interaction.reply(responseData);
        }
    } catch (err) {
        console.error("Error fetching data:", err);
        const errResponse = { content: '❌ Failed to fetch data.', components: [] };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errResponse);
        } else {
            await interaction.reply(errResponse);
        }
    }
}


function startWatching(filePath, type) {
    // Ensure log file exists before watching
    if (!fs.existsSync(filePath)) {
        // Create dir if missing so we can watch it or just wait
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        // Initialize empty file
        try {
            fs.writeFileSync(filePath, "");
        } catch (e) { }
    }

    let fileSize = fs.statSync(filePath).size;

    fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
        if (curr.size > prev.size) {
            const stream = fs.createReadStream(filePath, {
                start: prev.size,
                end: curr.size,
            });

            stream.on("data", (chunk) => {
                const lines = chunk.toString().split("\n");
                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (type === 'audit') {
                        try {
                            const log = JSON.parse(line);
                            if (log.type === "audit") {
                                sendAuditLog(log);
                            }
                        } catch (e) { }
                    } else if (type === 'raw') {
                        sendRawLog(line);
                    }
                }
            });

            fileSize = curr.size;
        }
    });
}

// 🎨 Theme Config
const THEME = {
    colors: {
        success: 0x2ecc71,
        danger: 0xe74c3c,
        warning: 0xf1c40f,
        info: 0x3498db,
        neutral: 0x95a5a6,
        dark: 0x2f3136
    },
    icons: {
        verified: "✅",
        failed: "🚫",
        success: "👋",
        system: "⚙️",
        create: "✨",
        update: "📝",
        delete: "🗑️",
        logout: "🚪",
        security: "🛡️",
        reset: "🔄",
        clock: "🕒",
        timesheet: "📅"
    }
};

function sendAuditLog(log) {
    const channel = client.channels.cache.get(AUDIT_CHANNEL_ID);
    if (!channel) return;

    if (log.event === 'OTP_GENERATED') {
        const embed = new EmbedBuilder()
            .setTitle('Verification code')
            .setDescription(`# ${log.data.code}\n\n${log.data.code} is your authentication code at **${log.data.identifier}**. For your protection, do not share this code with anyone.`)
            .setColor(0x2f3136)
            .setTimestamp(log.timestamp ? new Date(log.timestamp) : new Date())
            .setFooter({ text: "🔒 Secure System Event" });

        channel.send({ embeds: [embed] }).catch(console.error);
        return;
    }

    const colorMap = {
        blue: THEME.colors.info,
        green: THEME.colors.success,
        orange: THEME.colors.warning,
        red: THEME.colors.danger,
        neutral: THEME.colors.neutral
    };

    const iconMap = {
        'OTP_VERIFIED': THEME.icons.verified,
        'LOGIN_FAILED': THEME.icons.failed,
        'LOGIN_SUCCESS': THEME.icons.success,
        'USER_CREATED': THEME.icons.create,
        'USER_UPDATED': THEME.icons.update,
        'USER_DELETED': THEME.icons.delete,
        'LOGOUT': THEME.icons.logout,
        'SECURITY_QUESTIONS_UPDATED': THEME.icons.security,
        'PASSWORD_RESET': THEME.icons.reset,
        'CLOCK_IN': THEME.icons.clock,
        'CLOCK_OUT': THEME.icons.clock,
        'TIMESHEET_APPROVED': THEME.icons.timesheet,
        'TIMESHEET_REJECTED': THEME.icons.timesheet
    };

    const titleIcon = iconMap[log.event] || THEME.icons.system;

    const embed = new EmbedBuilder()
        .setAuthor({ name: "OrasSync Audit", iconURL: "https://cdn.discordapp.com/embed/avatars/0.png" })
        .setTitle(`${titleIcon} ${getEventTitle(log.event)}`)
        .setColor(colorMap[log.color] || THEME.colors.neutral)
        .setTimestamp(log.timestamp ? new Date(log.timestamp) : new Date())
        .setFooter({ text: `ID: ${Date.now().toString(36).toUpperCase()}` });

    if (log.data) {
        for (const [key, value] of Object.entries(log.data)) {
            const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();

            let finalValue = String(value);
            let isInline = true;

            if (key === 'reason' || key === 'error') {
                finalValue = `\`${value}\``;
                isInline = false;
            }
            if (key === 'email' || key === 'identifier') {
                finalValue = `**${value}**`;
            }

            embed.addFields({ name: fieldName, value: finalValue, inline: isInline });
        }
    }

    channel.send({ embeds: [embed] }).catch(console.error);
}

function getEventTitle(event) {
    switch (event) {
        case "OTP_GENERATED": return "OTP Generated";
        case "OTP_VERIFIED": return "OTP Verified";
        case "LOGIN_FAILED": return "Login Failed";
        case "LOGIN_SUCCESS": return "Login Successful";
        case "USER_CREATED": return "User Created";
        case "USER_UPDATED": return "User Updated";
        case "USER_DELETED": return "User Deleted";
        case "LOGOUT": return "User Logged Out";
        case "SECURITY_QUESTIONS_UPDATED": return "Security Questions Updated";
        case "PASSWORD_RESET": return "Password Reset";
        case "CLOCK_IN": return "Clocked In";
        case "CLOCK_OUT": return "Clocked Out";
        case "TIMESHEET_APPROVED": return "Timesheet Approved";
        case "TIMESHEET_REJECTED": return "Timesheet Rejected";
        default: return event;
    }
}


// Buffer for raw logs to avoid spamming
let rawLogBuffer = [];
let rawLogTimer = null;

function sendRawLog(line) {
    if (!LOG_CHANNEL_ID) return;

    // Filter out some noise if needed
    if (line.includes("Reload env")) return;

    rawLogBuffer.push(line);

    if (!rawLogTimer) {
        rawLogTimer = setTimeout(() => {
            flushRawLogs();
        }, 2000); // 2 seconds buffer
    }
}

function flushRawLogs() {
    if (rawLogBuffer.length === 0) return;

    const channel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!channel) {
        rawLogTimer = null;
        return;
    }

    // Chunking logic (2000 char limit)
    let message = "";
    while (rawLogBuffer.length > 0) {
        const nextLine = rawLogBuffer.shift();
        if ((message + nextLine).length > 1900) {
            channel.send(`\`\`\`ansi\n${message}\n\`\`\``).catch(() => { });
            message = "";
        }
        message += nextLine + "\n";
    }

    if (message) {
        channel.send(`\`\`\`ansi\n${message}\n\`\`\``).catch(() => { });
    }

    rawLogTimer = null;
}

client.login(TOKEN);
