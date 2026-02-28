"use strict";

import { Block } from "@/stores/email-builder-store";

export function generateHtmlFromBlocks(blocks: Block[]): string {
    return blocks
        .map((block) => {
            const { type, content, style } = block;
            const c = content as any;

            // Build comprehensive inline style string
            const styles: string[] = [
                `padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px`,
            ];

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
                    return `<${tag} style="${styleStr}; margin: 0; line-height: 1.3">${escapeHtml(c.text)}</${tag}>`;
                }

                case "subheading":
                    return `<h3 style="${styleStr}; margin: 0; line-height: 1.4">${escapeHtml(c.text)}</h3>`;

                case "text":
                    return `<div style="${styleStr}; word-break: break-word; line-height: 1.6">${escapeHtml(c.text)}</div>`;

                case "list": {
                    const tag = c.ordered ? "ol" : "ul";
                    const items = (c.items || []).map((item: string) => `<li>${escapeHtml(item)}</li>`).join("");
                    return `<${tag} style="${styleStr}; padding-left: ${(style.paddingLeft || 16) + 20}px; margin: 0; line-height: 1.8">${items}</${tag}>`;
                }

                case "button": {
                    const btnBg = style.backgroundColor !== "transparent" ? style.backgroundColor : "#2563eb";
                    const btnColor = style.textColor !== "#1a1a2e" ? style.textColor : "#ffffff";
                    const btnWidth = c.buttonWidth === "full" ? "width: 100%;" : c.buttonWidth === "fixed" ? `width: ${c.buttonWidthValue || 200}px;` : "";
                    const justify = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start";
                    return `<div style="display: flex; justify-content: ${justify}; padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px"><a href="${c.url}" style="display: inline-block; ${btnWidth} padding: 12px 28px; background-color: ${btnBg}; color: ${btnColor}; text-decoration: none; border-radius: ${style.borderRadius || 8}px; font-weight: 600; font-size: ${style.fontSize || 16}px; text-align: center;">${escapeHtml(c.text)}</a></div>`;
                }

                case "image": {
                    const justify = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start";
                    const img = `<img src="${c.url}" alt="${escapeHtml(c.alt || "")}" style="max-width: ${c.width || "100%"}; height: auto; display: block;${style.borderRadius ? ` border-radius: ${style.borderRadius}px;` : ""}" />`;
                    const wrapped = c.linkUrl ? `<a href="${c.linkUrl}">${img}</a>` : img;
                    return `<div style="display: flex; justify-content: ${justify}; padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px">${wrapped}</div>`;
                }

                case "divider":
                    return `<div style="padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px"><hr style="border: 0; border-top: ${c.lineHeight || 1}px ${c.lineStyle || "solid"} ${c.lineColor || "#e2e8f0"}; margin: 0;" /></div>`;

                case "spacer":
                    return `<div style="height: ${c.height || 32}px; line-height: ${c.height || 32}px; font-size: 1px;">&nbsp;</div>`;

                case "social": {
                    const justify = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start";
                    const links = (c.links || [])
                        .map((link: any) => {
                            const label = link.platform.charAt(0).toUpperCase() + link.platform.slice(1);
                            return `<a href="${link.url}" style="display: inline-block; padding: 8px 12px; background-color: ${style.backgroundColor !== "transparent" ? style.backgroundColor : "#f1f5f9"}; color: ${style.textColor !== "#1a1a2e" ? style.textColor : "#475569"}; text-decoration: none; border-radius: 50%; margin: 0 4px; font-size: ${c.iconSize || 24}px;" title="${label}">${label.charAt(0)}</a>`;
                        })
                        .join("");
                    return `<div style="display: flex; justify-content: ${justify}; gap: 8px; padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px">${links}</div>`;
                }

                case "columns": {
                    const children: Block[][] = c.children || [];
                    const cols = Array.from({ length: c.columns || 2 })
                        .map((_, idx) => {
                            const colContent = children[idx] ? generateHtmlFromBlocks(children[idx]) : "";
                            return `<td style="width: ${100 / (c.columns || 2)}%; padding: ${(c.gap || 16) / 2}px; vertical-align: top;">${colContent}</td>`;
                        })
                        .join("");
                    return `<table width="100%" cellpadding="0" cellspacing="0" style="padding: ${style.paddingTop}px ${style.paddingRight}px ${style.paddingBottom}px ${style.paddingLeft}px"><tr>${cols}</tr></table>`;
                }

                default:
                    return "";
            }
        })
        .join("\n");
}

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
