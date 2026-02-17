import { prisma } from './db';

export type AuditEvent = {
    type: "audit" | "system";
    event: string;
    color: string;
    data: Record<string, any>;
};

export async function logAudit(payload: AuditEvent) {
    try {
        await prisma.D_tbldiscord_log.create({
            data: {
                type: payload.type || 'audit',
                event: payload.event,
                color: payload.color,
                data: JSON.stringify(payload.data)
            }
        });
    } catch (error) {
        console.error("Failed to write to DB log:", error);
    }
}