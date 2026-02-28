"use client";

import { Block, BlockType } from "@/stores/email-builder-store";
import { CSSProperties } from "react";
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Globe } from "lucide-react";

interface BlockRendererProps {
    block: Block;
}

const SOCIAL_ICONS: Record<string, any> = {
    facebook: Facebook,
    instagram: Instagram,
    linkedin: Linkedin,
    twitter: Twitter,
    youtube: Youtube,
};

export function BlockRenderer({ block }: BlockRendererProps) {
    const { type, content, style } = block;

    const baseStyle: CSSProperties = {
        paddingTop: `${style.paddingTop}px`,
        paddingBottom: `${style.paddingBottom}px`,
        paddingLeft: `${style.paddingLeft}px`,
        paddingRight: `${style.paddingRight}px`,
        marginTop: style.marginTop ? `${style.marginTop}px` : undefined,
        marginBottom: style.marginBottom ? `${style.marginBottom}px` : undefined,
        backgroundColor: style.backgroundColor === "transparent" ? undefined : style.backgroundColor,
        color: style.textColor,
        textAlign: style.textAlign,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderColor: style.borderWidth ? style.borderColor : undefined,
        borderStyle: style.borderWidth ? style.borderStyle : undefined,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        fontWeight: style.fontWeight || undefined,
        width: "100%",
        boxSizing: "border-box",
    };

    switch (type) {
        case "heading": {
            const c = content as any;
            const level = c.level || 2;
            const Tag = `h${level}` as any;
            return (
                <Tag style={{ ...baseStyle, margin: 0, lineHeight: 1.3 }}>
                    {c.text || "Título"}
                </Tag>
            );
        }

        case "subheading":
            return (
                <h3 style={{ ...baseStyle, margin: 0, lineHeight: 1.4 }}>
                    {(content as any).text || "Subtítulo"}
                </h3>
            );

        case "text":
            return (
                <div style={{ ...baseStyle, wordBreak: "break-word", lineHeight: 1.6 }}>
                    {(content as any).text || "Seu texto aqui..."}
                </div>
            );

        case "list": {
            const c = content as any;
            const items: string[] = c.items || ["Item 1"];
            const Tag = c.ordered ? "ol" : "ul";
            return (
                <Tag style={{ ...baseStyle, paddingLeft: `${(style.paddingLeft || 16) + 20}px`, margin: 0, lineHeight: 1.8 }}>
                    {items.map((item: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{item}</li>
                    ))}
                </Tag>
            );
        }

        case "button": {
            const c = content as any;
            const btnBg = style.backgroundColor !== "transparent" ? style.backgroundColor : "#2563eb";
            const btnColor = style.textColor !== "#1a1a2e" ? style.textColor : "#ffffff";
            const btnWidth = c.buttonWidth === "full" ? "100%" : c.buttonWidth === "fixed" ? `${c.buttonWidthValue || 200}px` : "auto";

            return (
                <div style={{
                    ...baseStyle,
                    backgroundColor: undefined, // container is transparent
                    display: "flex",
                    justifyContent: style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start",
                }}>
                    <a
                        href={c.url || "#"}
                        onClick={(e) => e.preventDefault()}
                        style={{
                            display: "inline-block",
                            width: btnWidth,
                            padding: "12px 28px",
                            backgroundColor: btnBg,
                            color: btnColor,
                            textDecoration: "none",
                            borderRadius: style.borderRadius ? `${style.borderRadius}px` : "8px",
                            fontWeight: 600,
                            fontSize: style.fontSize ? `${style.fontSize}px` : "16px",
                            textAlign: "center",
                            transition: "all 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                    >
                        {c.text || "Botão"}
                    </a>
                </div>
            );
        }

        case "image": {
            const c = content as any;
            const justify = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start";
            return (
                <div style={{ ...baseStyle, display: "flex", justifyContent: justify, backgroundColor: undefined }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={c.url}
                        alt={c.alt || "Imagem"}
                        style={{
                            maxWidth: c.width || "100%",
                            height: "auto",
                            borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
                            display: "block",
                        }}
                    />
                </div>
            );
        }

        case "divider": {
            const c = content as any;
            return (
                <div style={{ ...baseStyle, backgroundColor: undefined }}>
                    <div
                        style={{
                            height: 0,
                            borderTopWidth: `${c.lineHeight || 1}px`,
                            borderTopStyle: (c.lineStyle as any) || "solid",
                            borderTopColor: c.lineColor || "hsl(var(--border))",
                            width: "100%",
                        }}
                    />
                </div>
            );
        }

        case "spacer": {
            const c = content as any;
            return (
                <div style={{ height: `${c.height || 32}px`, width: "100%" }}>
                    <div className="flex h-full items-center justify-center">
                        <span className="text-[10px] text-muted-foreground/40 select-none">
                            {c.height || 32}px
                        </span>
                    </div>
                </div>
            );
        }

        case "social": {
            const c = content as any;
            const links = c.links || [];
            return (
                <div style={{ ...baseStyle, display: "flex", gap: "12px", justifyContent: style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start", backgroundColor: undefined }}>
                    {links.map((link: any, idx: number) => {
                        const IconComp = SOCIAL_ICONS[link.platform] || Globe;
                        return (
                            <a
                                key={idx}
                                href={link.url}
                                onClick={(e) => e.preventDefault()}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: `${c.iconSize + 16}px`,
                                    height: `${c.iconSize + 16}px`,
                                    borderRadius: "50%",
                                    backgroundColor: style.backgroundColor !== "transparent" ? style.backgroundColor : "hsl(var(--muted))",
                                    color: style.textColor !== "#1a1a2e" ? style.textColor : "hsl(var(--muted-foreground))",
                                    textDecoration: "none",
                                    transition: "all 0.2s",
                                }}
                            >
                                <IconComp style={{ width: c.iconSize, height: c.iconSize }} />
                            </a>
                        );
                    })}
                </div>
            );
        }

        case "columns": {
            const c = content as any;
            const children: Block[][] = c.children || [];
            return (
                <div style={{
                    ...baseStyle,
                    display: "grid",
                    gridTemplateColumns: `repeat(${c.columns || 2}, 1fr)`,
                    gap: `${c.gap || 16}px`,
                    backgroundColor: undefined,
                }}>
                    {Array.from({ length: c.columns || 2 }).map((_, idx) => {
                        const colChildren = children[idx] || [];
                        return (
                            <div
                                key={idx}
                                className={`min-h-[60px] rounded-md border-2 border-dashed ${colChildren.length === 0 ? "flex items-center justify-center border-muted-foreground/20" : "border-transparent p-1"}`}
                            >
                                {colChildren.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/40">Coluna {idx + 1}</span>
                                ) : (
                                    colChildren.map((child) => (
                                        <div key={child.id} className="mb-1">
                                            <BlockRenderer block={child} />
                                        </div>
                                    ))
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        default:
            return <div style={baseStyle}>Bloco desconhecido</div>;
    }
}
