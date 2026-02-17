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

// 📊 Live Dashboards Tracking
const liveDashboards = new Map(); // interactionId -> { interaction, expiresAt }

// Register Slash Command
client.once("ready", async () => {
    console.log(`✅ Audit Bot (JS) Online as ${client.user.tag}`);
    console.log(`📡 Watching Audit Log: ${AUDIT_LOG_FILE}`);
    console.log(`📡 Watching Raw Log: ${RAW_LOG_FILE}`);

    // Register slash commands
    const commands = [
        {
            name: 'database',
            description: 'Explore the database (Read-Only)',
        },
        {
            name: 'online',
            description: 'View current status of all active users',
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

    startDatabasePolling();
    startDashboardRefreshLoop();

    // 📂 Start File Watchers (Legacy/Direct Log Support)
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
            } else if (interaction.commandName === 'online') {
                await handleOnlineCommand(interaction);
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
            } else if (interaction.customId === 'dashboard_refresh') {
                // Re-register dashboard and manual refresh
                liveDashboards.set(interaction.message.interaction?.id || interaction.id, {
                    interaction,
                    expiresAt: Date.now() + (60 * 60 * 1000)
                });
                const table = await generateUserStatusTable();
                await interaction.update({ content: `\`\`\`\n${table}\n\`\`\`` });
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

// Configuration for detailed views
const MODEL_CONFIG = {
    'D_tbluser': {
        include: {
            D_tblrole: true,
            D_tblposition: true,
            D_tbldepartment: true,
            D_tblteam: true,
            D_tbluser_D_tbluser_supervisor_idToD_tbluser: true, // Supervisor
            D_tbluser_D_tbluser_manager_idToD_tbluser: true,    // Manager
            D_tbluser_authentication: true
        },
        format: (r) => ({
            "User ID": r.user_id,
            "Full Name": `${r.first_name} ${r.last_name}`,
            "Email": r.email,
            "Role": r.D_tblrole?.role_name || r.role_id || 'N/A',
            "Position": r.D_tblposition?.pos_name || r.pos_id || 'N/A',
            "Department": r.D_tbldepartment?.dept_name || r.dept_id || 'N/A',
            "Team": r.D_tblteam?.team_name || r.team_id || 'N/A',
            "Account Status": r.account_status,
            "Supervisor": formatUserRef(r.D_tbluser_D_tbluser_supervisor_idToD_tbluser),
            "Manager": formatUserRef(r.D_tbluser_D_tbluser_manager_idToD_tbluser),
            "Password Hash": r.D_tbluser_authentication?.password_hash ? `\`${r.D_tbluser_authentication.password_hash.substring(0, 20)}...\`` : 'N/A',
            "Created At": r.account_created_at
        })
    },
    'D_tbltime_log': {
        include: {
            D_tbluser_D_tbltime_log_user_idToD_tbluser: true,
            D_tblactivity: true
        },
        format: (r) => ({
            "Log ID": r.tlog_id,
            "User": formatUserRef(r.D_tbluser_D_tbltime_log_user_idToD_tbluser),
            "Activity": r.D_tblactivity?.activity_name || r.activity_id,
            "Date": r.log_date,
            "Start": r.start_time,
            "End": r.end_time,
            "Total Hours": r.total_hours,
            "Status": r.approval_status
        })
    }
};

function formatUserRef(u) {
    if (!u) return 'None';
    return `${u.first_name} ${u.last_name} (${u.user_id})`;
}

async function handleOnlineCommand(interaction) {
    await interaction.deferReply();

    const table = await generateUserStatusTable();
    const dashboardText = `\`\`\`\n${table}\n\`\`\``;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_refresh')
            .setLabel('Manual Refresh')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ content: dashboardText, components: [row] });

    // Registry for Live Updates
    liveDashboards.set(interaction.id, {
        interaction,
        expiresAt: Date.now() + (60 * 60 * 1000)
    });
}

/**
 * 🛠️ Generates the ASCII Status Table
 */
async function generateUserStatusTable() {
    try {
        // 1. Get all users who aren't explicitly deactivated
        const users = await prisma.D_tbluser.findMany({
            where: {
                OR: [
                    { account_status: 'ACTIVE' },
                    { account_status: null }
                ]
            },
            orderBy: { user_id: 'asc' }
        });

        // 2. Get currently clocked-in logs
        const activeLogs = await prisma.D_tblclock_log.findMany({
            where: { clock_out_time: null }
        });

        const onlineUserIds = new Set(activeLogs.map(log => log.user_id));

        // 3. Build ASCII Table
        let table = `╔════════════════════════════════════════╗\n`;
        table += `║         👥 USER STATUS DASHBOARD       ║\n`;
        table += `║         (Live • Auto-refreshes)        ║\n`;
        table += `╠════════════════════════════════════════╣\n`;
        table += `║ ID   | USER            | STATUS        ║\n`;
        table += `╟──────┼─────────────────┼───────────────╢\n`;

        for (const user of users) {
            const name = `${user.first_name || ''} ${user.last_name || ''}`.trim().padEnd(15).substring(0, 15);
            const id = user.user_id.padEnd(4).substring(0, 4);
            const isOnline = onlineUserIds.has(user.user_id);
            const status = isOnline ? '🟢 ONLINE ' : '🔴 OFFLINE';

            table += `║ ${id} | ${name} | ${status}  ║\n`;
        }

        table += `╚════════════════════════════════════════╝\n`;
        table += `Total Users: ${users.length}\n`;
        table += `Last Sync: ${new Date().toLocaleTimeString()}`;

        return table;
    } catch (error) {
        console.error("Error generating status table:", error);
        return "❌ Error: Could not generate status table.";
    }
}

/**
 * 🔄 Live Refresh Loop for Online Dashboards
 */
function startDashboardRefreshLoop() {
    console.log("🔄 Starting Live Dashboard Refresh Loop (15s)...");
    setInterval(async () => {
        if (liveDashboards.size === 0) return;

        const table = await generateUserStatusTable();
        const dashboardText = `\`\`\`\n${table}\n\`\`\``;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_refresh')
                .setLabel('Manual Refresh')
                .setStyle(ButtonStyle.Primary)
        );

        for (const [id, entry] of liveDashboards.entries()) {
            // Check for expiration
            if (Date.now() > entry.expiresAt) {
                console.log(`🧹 Removing expired dashboard: ${id}`);
                liveDashboards.delete(id);
                continue;
            }

            try {
                await entry.interaction.editReply({ content: dashboardText, components: [row] });
            } catch (e) {
                // If message deleted or interaction failed, try a standalone edit if possible
                // or just cleanup
                console.warn(`⚠️ Dashboard ${id} unreachable, removing from tracker.`);
                liveDashboards.delete(id);
            }
        }
    }, 15000); // 15 seconds refresh
}

/**
 * 🛰️ Database Polling (Communication Bridge)
 * This replaces the local file-watching system.
 */
function startDatabasePolling() {
    console.log("📡 Starting Database Polling for logs...");
    setInterval(async () => {
        try {
            // Fetch unsent logs
            const logs = await prisma.D_tbldiscord_log.findMany({
                where: { is_sent: false },
                orderBy: { created_at: 'asc' },
                take: 10
            });

            for (const log of logs) {
                try {
                    const data = JSON.parse(log.data);
                    const timestamp = log.created_at;

                    if (log.type === 'audit') {
                        sendAuditLog({ ...data, event: log.event, color: log.color, timestamp });
                    } else {
                        // system/raw logs
                        sendRawLog(`[${log.event}] ${log.color}: ${log.data}`);
                    }

                    // Mark as sent
                    await prisma.D_tbldiscord_log.update({
                        where: { log_id: log.log_id },
                        data: { is_sent: true }
                    });
                } catch (e) {
                    console.error("Error processing log item:", log.log_id, e);
                }
            }
        } catch (error) {
            // Silently fail or log to console - prevents crashing the bot on DB hiccups
            console.error("Polling error:", error.message);
        }
    }, 3000); // Poll every 3 seconds
}

async function handleTableView(interaction, tableName, page) {
    const REC_PER_PAGE = 1; // 1 Record per page for "Card View" style

    // Defer interaction immediately to prevent timeout
    try {
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply({ ephemeral: true });
            }
        }
    } catch (e) {
        console.error("Error deferring interaction:", e);
        return;
    }

    // @ts-ignore
    const model = prisma[tableName]; // Dynamic access

    if (!model) {
        await interaction.editReply({ content: `❌ Model ${tableName} not found via Prisma.`, components: [], embeds: [] });
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

            await interaction.editReply({ embeds: [embed], components: [buttons], content: '' });
            return;
        }

        // Use configuration if available
        const config = MODEL_CONFIG[tableName] || {};

        const data = await model.findMany({
            take: REC_PER_PAGE,
            skip: page * REC_PER_PAGE,
            include: config.include || undefined
        });

        const rawRecord = data[0]; // Since we are showing 1 record per page for cleaner UI

        // Format record if config exists, otherwise use raw
        const record = config.format ? config.format(rawRecord) : rawRecord;

        const embed = new EmbedBuilder()
            .setTitle(`🗄️ ${tableName}`)
            .setDescription(`**Record #${(page * REC_PER_PAGE) + 1}** of ${count} (Page ${page + 1}/${totalPages})`)
            .setColor(THEME.colors.info)
            .setFooter({ text: 'OrasSync Database Explorer' })
            .setTimestamp();

        // Format fields nicely
        for (const [k, v] of Object.entries(record)) {
            let val = v;
            if (val instanceof Date) val = `<t:${Math.floor(val.getTime() / 1000)}:f>`; // Discord timestamp
            if (val === null) val = '*null*';
            if (val === undefined) val = 'N/A';

            let strVal = String(val);
            let isInline = true;

            // Special formatting for long text or code blocks
            if ((k.toLowerCase().includes('hash') || k.toLowerCase().includes('id')) && strVal.length > 20) {
                strVal = `\`${strVal}\``;
                isInline = false; // Long IDs/Hashes on own line
            }

            // If value is very long, truncate or formatted block
            if (strVal.length > 50) {
                isInline = false;
            }

            if (strVal.length > 1024) strVal = strVal.substring(0, 1021) + '...';

            embed.addFields({
                name: k,
                value: strVal,
                inline: isInline
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

        await interaction.editReply({
            content: '',
            embeds: [embed],
            components: [buttons]
        });

    } catch (err) {
        console.error("Error fetching data:", err);
        const errResponse = { content: '❌ Failed to fetch data.', components: [], embeds: [] };
        // We can safely use editReply here since we deferred earlier
        try {
            await interaction.editReply(errResponse);
        } catch (e) {
            console.error("Failed to send error response:", e);
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