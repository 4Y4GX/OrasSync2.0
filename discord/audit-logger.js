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

client.once("ready", () => {
    console.log(`✅ Audit Bot (JS) Online as ${client.user.tag}`);
    console.log(`📡 Watching Audit Log: ${AUDIT_LOG_FILE}`);
    console.log(`📡 Watching Raw Log: ${RAW_LOG_FILE}`);
    startWatching(AUDIT_LOG_FILE, 'audit');
    startWatching(RAW_LOG_FILE, 'raw');
});

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
