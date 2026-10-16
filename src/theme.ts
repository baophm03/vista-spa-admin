import type { ThemeConfig } from 'antd'

export const brandColors = {
  primary: '#8E63A9',
  primaryDark: '#54316F',
  primaryLight: '#E9DDF0',
  accent: '#C9A66B',
  background: '#FAF7F3',
  surface: '#FFFFFF',
  text: '#292331',
  textSecondary: '#6F7071',
  textInactive: '#A9ADB2',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  border: '#E9DDF0',
  borderStrong: '#D9C7E4',
  section: '#F5F1F7',
  tierVista: '#C9A66B',
  tierVip: '#8E63A9',
  tierDiamond: '#54316F',
}

export const theme: ThemeConfig = {
  token: {
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorPrimary: brandColors.primary,
    colorInfo: brandColors.primary,
    colorLink: brandColors.primary,
    colorText: brandColors.text,
    colorTextSecondary: brandColors.textSecondary,
    colorBgLayout: brandColors.background,
    colorSuccess: brandColors.success,
    colorWarning: brandColors.warning,
    colorError: brandColors.danger,
    colorBorder: brandColors.borderStrong,
    colorBorderSecondary: brandColors.border,
    borderRadius: 12,
    borderRadiusSM: 8,
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
