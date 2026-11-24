import { Fragment } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import type { InfoArticleBodyFormat } from "@mentor/types";
import {
  extractInternalArticleSlug,
  isSafeHttpUrl,
  parseMarkdownBlocks,
  type InlineRun,
  type MarkdownBlock,
} from "../../lib/knowledge-view.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

function InlineText({
  runs,
  baseSize = 15,
  baseLineHeight = 24,
  baseWeight = "600",
  color,
  textAlign,
  onOpenArticle,
}: {
  runs: InlineRun[];
  baseSize?: number;
  baseLineHeight?: number;
  baseWeight?: "600" | "700" | "800";
  color?: string;
  textAlign?: "left" | "center" | "right";
  onOpenArticle?: (slug: string) => void;
}) {
  const { palette } = useThemeTokens();
  const ink = color ?? palette.main;

  const handleLink = (href: string) => {
    const internalSlug = extractInternalArticleSlug(href);
    if (internalSlug && onOpenArticle) {
      onOpenArticle(internalSlug);
      return;
    }
    if (isSafeHttpUrl(href)) {
      void Linking.openURL(href);
    }
  };

  return (
    <AppText
      style={{
        fontSize: baseSize,
        lineHeight: baseLineHeight,
        fontWeight: baseWeight,
        color: ink,
        textAlign,
      }}
    >
      {runs.map((run, idx) => {
        if (run.href) {
          const canOpen = Boolean(extractInternalArticleSlug(run.href) && onOpenArticle) || isSafeHttpUrl(run.href);
          return (
            <AppText
              key={idx}
              onPress={canOpen ? () => handleLink(run.href!) : undefined}
              style={{
                fontSize: baseSize,
                lineHeight: baseLineHeight,
                fontWeight: "800",
                color: palette.playSelectedInk,
                textDecorationLine: canOpen ? "underline" : "none",
              }}
            >
              {run.text}
            </AppText>
          );
        }
        return (
          <AppText
            key={idx}
            style={{
              fontSize: baseSize,
              lineHeight: baseLineHeight,
              fontWeight: run.bold ? "800" : baseWeight,
              fontStyle: run.italic ? "italic" : "normal",
              color: run.bold ? palette.main : ink,
              backgroundColor: run.code ? palette.surfaceAlt : undefined,
            }}
          >
            {run.text}
          </AppText>
        );
      })}
    </AppText>
  );
}

export function ArticleMarkdown({
  body,
  format,
  compact = false,
  onOpenArticle,
}: {
  body: string;
  format: InfoArticleBodyFormat;
  compact?: boolean;
  onOpenArticle?: (slug: string) => void;
}) {
  const { palette, radii } = useThemeTokens();
  const blocks = parseMarkdownBlocks(body, format);
  const textColor = palette.secondary;
  const bodySize = compact ? 13 : 15;
  const bodyLine = compact ? 20 : 24;

  const renderBlock = (block: MarkdownBlock, index: number) => {
    switch (block.kind) {
      case "heading":
        return (
          <View key={index} style={block.level === 2 ? styles.h2Wrap : styles.h3Wrap}>
            <InlineText
              runs={block.runs}
              baseSize={block.level === 2 ? 19 : 17}
              baseLineHeight={block.level === 2 ? 25 : 23}
              baseWeight="800"
              color={palette.main}
              onOpenArticle={onOpenArticle}
            />
          </View>
        );
      case "paragraph":
        return (
          <View key={index}>
            <InlineText
              runs={block.runs}
              baseSize={bodySize}
              baseLineHeight={bodyLine}
              color={textColor}
              onOpenArticle={onOpenArticle}
            />
          </View>
        );
      case "blockquote":
        return (
          <View
            key={index}
            style={[
              styles.blockquote,
              { backgroundColor: palette.playSelected, borderRadius: radii.card },
            ]}
          >
            {block.blocks.map((p, pIdx) => (
              <InlineText
                key={pIdx}
                runs={p.runs}
                baseSize={14}
                baseLineHeight={22}
                color={palette.main}
                onOpenArticle={onOpenArticle}
              />
            ))}
          </View>
        );
      case "list":
        return (
          <View key={index} style={styles.list}>
            {block.items.map((itemRuns, itemIdx) => (
              <View key={itemIdx} style={styles.listItem}>
                <AppText
                  style={{
                    fontSize: bodySize,
                    lineHeight: bodyLine,
                    fontWeight: "800",
                    color: palette.secondary,
                    minWidth: 16,
                  }}
                >
                  {block.ordered ? `${itemIdx + 1}.` : "•"}
                </AppText>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <InlineText
                    runs={itemRuns}
                    baseSize={bodySize}
                    baseLineHeight={bodyLine}
                    color={textColor}
                    onOpenArticle={onOpenArticle}
                  />
                </View>
              </View>
            ))}
          </View>
        );
      case "table": {
        const fitsContainer = block.headers.length <= 3;
        const cellLayout = (colIdx: number) =>
          fitsContainer
            ? [styles.tableCellFit, { flex: colIdx === 0 && block.headers.length === 3 ? 1.15 : 1 }]
            : styles.tableCellWide;
        const alignmentStyle = (colIdx: number) =>
          block.alignments[colIdx] === "right"
            ? styles.alignRight
            : block.alignments[colIdx] === "center"
              ? styles.alignCenter
              : null;

        const tableNode = (
          <View
            style={[
              styles.table,
              fitsContainer ? styles.tableFullWidth : null,
              { borderColor: palette.border, borderRadius: radii.inner },
            ]}
          >
            <View style={[styles.tableRow, { borderBottomColor: palette.border, backgroundColor: palette.surfaceAlt }]}>
              {block.headers.map((headerRuns, colIdx) => (
                <View key={colIdx} style={[cellLayout(colIdx), alignmentStyle(colIdx)]}>
                  <InlineText
                    runs={headerRuns}
                    baseSize={13}
                    baseLineHeight={19}
                    baseWeight="800"
                    color={palette.main}
                    textAlign={block.alignments[colIdx]}
                    onOpenArticle={onOpenArticle}
                  />
                </View>
              ))}
            </View>
            {block.rows.map((row, rowIdx) => (
              <View
                key={rowIdx}
                style={[
                  styles.tableRow,
                  rowIdx < block.rows.length - 1
                    ? { borderBottomColor: palette.playLine }
                    : { borderBottomWidth: 0 },
                ]}
              >
                {row.map((cellRuns, colIdx) => (
                  <View
                    key={colIdx}
                    style={[cellLayout(colIdx), alignmentStyle(colIdx)]}
                  >
                    <InlineText
                      runs={cellRuns}
                      baseSize={13}
                      baseLineHeight={19}
                      color={textColor}
                      textAlign={block.alignments[colIdx]}
                      onOpenArticle={onOpenArticle}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        );

        return fitsContainer ? (
          <View key={index}>{tableNode}</View>
        ) : (
          <ScrollView key={index} horizontal showsHorizontalScrollIndicator>
            {tableNode}
          </ScrollView>
        );
      }
    }
  };

  return (
    <View style={compact ? styles.compactRoot : styles.root}>
      {blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block, index)}</Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  compactRoot: {
    gap: 8,
  },
  h2Wrap: {
    marginTop: 10,
  },
  h3Wrap: {
    marginTop: 6,
  },
  blockquote: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  list: {
    gap: 6,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  table: {
    borderWidth: 1,
    overflow: "hidden",
  },
  tableFullWidth: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCellFit: {
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tableCellWide: {
    width: 124,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  alignRight: {
    alignItems: "flex-end",
  },
  alignCenter: {
    alignItems: "center",
  },
});
