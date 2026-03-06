import type { WAContact } from "@/types/whatsapp";

const PLACEHOLDER_ONLY_PATTERN = /^[-–—_.]+$/;
const GENERIC_PLACEHOLDER_PATTERN =
    /^(?:null|undefined|none|n\/a|na|sem nome|sem_nome|desconhecido|unknown)$/i;

function normalizeContactField(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (PLACEHOLDER_ONLY_PATTERN.test(normalized)) return null;
    if (GENERIC_PLACEHOLDER_PATTERN.test(normalized)) return null;
    return normalized;
}

export function getContactPhone(contact?: WAContact | null): string {
    return (
        normalizeContactField(contact?.phone_display) ||
        normalizeContactField(contact?.phone_e164) ||
        normalizeContactField(contact?.phone_normalized) ||
        "–"
    );
}

export function getContactDisplayName(contact?: WAContact | null): string {
    return normalizeContactField(contact?.display_name) || getContactPhone(contact);
}

export function getContactPhotoUrl(contact?: WAContact | null): string | null {
    const url = normalizeContactField(contact?.profile_picture_url);
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return null;
}

export function getContactInitial(contact?: WAContact | null): string {
    const label = getContactDisplayName(contact);
    return label[0]?.toUpperCase() ?? "?";
}
