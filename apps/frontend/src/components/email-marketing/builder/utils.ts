"use strict";

import { Block } from "@/stores/email-builder-store";

// ── Constants ──────────────────────────────────────────────────────────────────

const FONT_STACK =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Brand colors for social media (pure HTML/CSS, no external images needed)
const SOCIAL_BRANDS: Record<string, { color: string; label: string; symbol: string }> = {
    facebook: { color: "#1877F2", label: "Facebook", symbol: "f" },
    instagram: { color: "#E4405F", label: "Instagram", symbol: "\u25CB" },
    linkedin: { color: "#0A66C2", label: "LinkedIn", symbol: "in" },
    twitter: { color: "#000000", label: "X", symbol: "X" },
    youtube: { color: "#FF0000", label: "YouTube", symbol: "\u25B6" },
};

// ── Inner block HTML (for canvas preview & DB storage) ─────────────────────────

/**
 * Generates inner HTML from blocks — used for canvas preview and stored in DB.
 * Does NOT include DOCTYPE/html/body wrapper.
 */
export function generateHtmlFromBlocks(blocks: Block[]): string {
    return blocks
        .map((block) => {
            const { type, content, style } = block;
            const c = content as any;

            // Build comprehensive inline style string
            const padStr = `padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px`;

            const styles: string[] = [padStr];

            if (style.marginTop) styles.push(`margin-top: ${style.marginTop}px`);
            if (style.marginBottom) styles.push(`margin-bottom: ${style.marginBottom}px`);
            if (style.backgroundColor && style.backgroundColor !== "transparent") {
                styles.push(`background-color: ${style.backgroundColor}`);
            }
            if (style.textColor) styles.push(`color: ${style.textColor}`);
            if (style.textAlign) styles.push(`text-align: ${style.textAlign}`);
            if (style.borderRadius) styles.push(`border-radius: ${style.borderRadius}px`);
            if (style.borderWidth && style.borderStyle !== "none") {
                styles.push(`border: ${style.borderWidth}px ${style.borderStyle} ${style.borderColor}`);
            }
            if (style.fontSize) styles.push(`font-size: ${style.fontSize}px`);
            if (style.fontWeight && style.fontWeight !== 400) styles.push(`font-weight: ${style.fontWeight}`);

            const styleStr = styles.join("; ");

            switch (type) {
                case "heading": {
                    const tag = `h${c.level || 2}`;
                    return `<${tag} style="${styleStr}; margin: 0; line-height: 1.3; font-family: ${FONT_STACK}">${escapeHtml(c.text)}</${tag}>`;
                }

                case "subheading":
                    return `<h3 style="${styleStr}; margin: 0; line-height: 1.4; font-family: ${FONT_STACK}">${escapeHtml(c.text)}</h3>`;

                case "text":
                    return `<div style="${styleStr}; word-break: break-word; line-height: 1.6; font-family: ${FONT_STACK}">${escapeHtml(c.text)}</div>`;

                case "list": {
                    const tag = c.ordered ? "ol" : "ul";
                    const items = (c.items || []).map((item: string) => `<li>${escapeHtml(item)}</li>`).join("");
                    return `<${tag} style="${styleStr}; padding-left: ${(style.paddingLeft || 16) + 20}px; margin: 0; line-height: 1.8; font-family: ${FONT_STACK}">${items}</${tag}>`;
                }

                case "button": {
                    const btnBg = style.backgroundColor !== "transparent" ? style.backgroundColor : "#2563eb";
                    const btnColor = style.textColor !== "#1a1a2e" ? style.textColor : "#ffffff";
                    const isFull = c.buttonWidth === "full";
                    const isFixed = c.buttonWidth === "fixed";
                    const innerTableWidth = isFull ? ` width="100%"` : "";
                    const tdWidthStyle = isFull ? "width: 100%;" : isFixed ? `width: ${c.buttonWidthValue || 200}px;` : "";
                    const linkDisplay = isFull ? "display: block;" : "display: inline-block;";
                    const align = style.textAlign === "right" ? "right" : style.textAlign === "left" ? "left" : "center";
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${padStr}"><tr><td align="${align}"><table cellpadding="0" cellspacing="0" border="0"${innerTableWidth}><tr><td align="center" style="${tdWidthStyle} padding: 12px 28px; background-color: ${btnBg}; border-radius: ${style.borderRadius || 8}px; font-family: ${FONT_STACK};"><a href="${c.url || "#"}" style="${linkDisplay} color: ${btnColor}; text-decoration: none; font-weight: 600; font-size: ${style.fontSize || 16}px; font-family: ${FONT_STACK}; text-align: center;">${escapeHtml(c.text)}</a></td></tr></table></td></tr></table>`;
                }

                case "image": {
                    const align = style.textAlign === "right" ? "right" : style.textAlign === "left" ? "left" : "center";
                    const imgUrl = c.url || "";
                    const img = `<img src="${imgUrl}" alt="${escapeHtml(c.alt || "")}" style="max-width: ${c.width || "100%"}; height: auto; display: block;${style.borderRadius ? ` border-radius: ${style.borderRadius}px;` : ""}" />`;
                    const wrapped = c.linkUrl ? `<a href="${c.linkUrl}">${img}</a>` : img;
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${padStr}"><tr><td align="${align}">${wrapped}</td></tr></table>`;
                }

                case "divider":
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${padStr}"><tr><td><hr style="border: 0; border-top: ${c.lineHeight || 1}px ${c.lineStyle || "solid"} ${c.lineColor || "#e2e8f0"}; margin: 0;" /></td></tr></table>`;

                case "spacer":
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height: ${c.height || 32}px; line-height: ${c.height || 32}px; font-size: 1px;">&nbsp;</td></tr></table>`;

                case "social": {
                    const align = style.textAlign === "right" ? "right" : style.textAlign === "left" ? "left" : "center";
                    const iconSize = c.iconSize || 32;
                    const linkCells = (c.links || [])
                        .map((link: any) => {
                            const brand = SOCIAL_BRANDS[link.platform] || { color: "#6b7280", label: link.platform, symbol: link.platform.charAt(0).toUpperCase() };
                            return `<td style="padding: 0 4px;"><a href="${link.url}" title="${brand.label}" style="display: inline-block; width: ${iconSize}px; height: ${iconSize}px; line-height: ${iconSize}px; background-color: ${brand.color}; color: #ffffff; text-align: center; text-decoration: none; border-radius: 50%; font-family: ${FONT_STACK}; font-size: ${Math.round(iconSize * 0.4)}px; font-weight: 700;">${brand.symbol}</a></td>`;
                        })
                        .join("");
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${padStr}"><tr><td align="${align}"><table cellpadding="0" cellspacing="0" border="0"><tr>${linkCells}</tr></table></td></tr></table>`;
                }

                case "columns": {
                    const children: Block[][] = c.children || [];
                    const cols = Array.from({ length: c.columns || 2 })
                        .map((_, idx) => {
                            const colContent = children[idx] ? generateHtmlFromBlocks(children[idx]) : "";
                            return `<td style="width: ${100 / (c.columns || 2)}%; padding: ${(c.gap || 16) / 2}px; vertical-align: top;">${colContent}</td>`;
                        })
                        .join("");
                    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${padStr}"><tr>${cols}</tr></table>`;
                }

                default:
                    return "";
            }
        })
        .join("\n");
}

// ── Full email HTML (for sending) ──────────────────────────────────────────────

/**
 * Generates a full, email-client-compatible HTML document with the blocks
 * wrapped in a proper email template. Use this for sending emails.
 */
export function generateEmailHtml(blocks: Block[]): string {
    const innerHtml = generateHtmlFromBlocks(blocks);

    return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <title></title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style type="text/css">
        /* Reset */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            .email-bg { background-color: #1a1a2e !important; }
            .email-container { background-color: #16213e !important; }
        }
        /* Responsive */
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: ${FONT_STACK};">
    <table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f7;">
        <tr>
            <td align="center" style="padding: 24px 16px;">
                <!--[if mso]>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center">
                <tr>
                <td>
                <![endif]-->
                <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="padding: 0;">
${innerHtml}
                        </td>
                    </tr>
                </table>
                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->

                <!-- Footer -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
                    <tr>
                        <td align="center" style="padding: 24px 16px; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: #9ca3af;">
                            <p style="margin: 0 0 8px 0;">Enviado por CompletePay</p>
                            <p style="margin: 0;"><a href="{{link_descadastro}}" style="color: #6b7280; text-decoration: underline;">Descadastrar</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ── Export blocks as JSON string (for storing in API) ──────────────────────────

export function serializeBlocks(blocks: Block[]): string {
    return JSON.stringify(blocks);
}

export function deserializeBlocks(json: string): Block[] {
    try {
        return JSON.parse(json);
    } catch {
        return [];
    }
}
