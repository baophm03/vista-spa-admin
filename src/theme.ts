import type { ThemeConfig } from 'antd'

export const brandColors = {
  primary: '#8E63A9',
  primaryDark: '#54316F',
  primaryLight: '#E9DDF0',
  accent: '#C9A66B',
  background: '#FAF7F3',
  surface: '#FFFFFF',
  text: '#292331',
}

export const theme: ThemeConfig = {
  token: {
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorPrimary: brandColors.primary,
    colorInfo: brandColors.primary,
    colorLink: brandColors.primary,
    colorText: brandColors.text,
    colorBgLayout: brandColors.background,
    borderRadius: 10,
    borderRadiusSM: 6,
    borderRadiusLG: 16,
    controlHeight: 40,
  },
  components: {
    Layout: {
      headerHeight: 64,
      headerPadding: '0 24px',
    },
    Menu: {
      itemHeight: 44,
      itemMarginInline: 12,
      itemBorderRadius: 10,
      groupTitleFontSize: 11,
    },
    Card: {
      paddingLG: 24,
      borderRadiusLG: 16,
    },
    Table: {
      headerBg: '#F5EFF8',
      cellPaddingBlock: 14,
      borderRadiusLG: 16,
    },
  },
}
