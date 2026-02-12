import fs from 'fs';
import path from 'path';

export type AuditEvent = {
    type: "audit";
    event: string;
    color: string;
    data: Record<string, any>;
};

export function logAudit(payload: AuditEvent) {
    try {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logFile = path.join(logDir, 'audit.log');
        const line = JSON.stringify({ ...payload, timestamp: new Date().toISOString() }) + '\n';

        fs.appendFileSync(logFile, line);
    } catch (error) {
        console.error("Failed to write audit log:", error);
    }
}
