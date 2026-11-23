import { isValidElement, useState } from 'react'
import type { ReactNode } from 'react'
import { Table } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import MobileCards, { MobileCardRow } from './MobileCards'
import ListPagination from './ListPagination'

type ResponsiveTableProps<T extends object> = TableProps<T> & {
  mobileTitleKey?: string
  mobileStatusKey?: string
  mobileHiddenKeys?: string[]
  mobileNoun?: string
  onMobileCardClick?: (row: T) => void
  emptyText?: string
}

type LeafColumn<T extends object> = Extract<TableColumnsType<T>[number], { dataIndex?: unknown }>

function columnTitle<T extends object>(column: LeafColumn<T>): string {
  if (typeof column.title === 'string') return column.title
  if (typeof column.key === 'string') return column.key
  if (typeof column.dataIndex === 'string') return column.dataIndex
  return ''
}

function flattenColumns<T extends object>(
  columns: TableColumnsType<T> = [],
  parentTitle = '',
): LeafColumn<T>[] {
  return columns.flatMap((column) => {
    if ('children' in column && column.children) {
      const title = columnTitle(column as LeafColumn<T>)
      return flattenColumns(column.children, [parentTitle, title].filter(Boolean).join(' / '))
    }
    const leaf = column as LeafColumn<T>
    if (!parentTitle) return [leaf]
    return [{ ...leaf, title: [parentTitle, columnTitle(leaf)].filter(Boolean).join(' / ') }]
  })
}

function readValue(row: unknown, path: unknown): unknown {
  if (typeof path !== 'string' && typeof path !== 'number' && !Array.isArray(path)) return undefined
  const parts = Array.isArray(path) ? path : String(path).split('.')
  return parts.reduce<unknown>((value, part) => {
    if (value == null || typeof value !== 'object') return undefined
    return (value as Record<string | number, unknown>)[part]
  }, row)
}

function cellValue<T extends object>(
  column: LeafColumn<T>,
  row: T,
  index: number,
): ReactNode {
  if (!('dataIndex' in column) && !column.render) return null
  const value = readValue(row, 'dataIndex' in column ? column.dataIndex : undefined)
  const rendered = column.render ? column.render(value, row, index) : value
  if (rendered && typeof rendered === 'object' && !isValidElement(rendered) && 'children' in rendered) {
    return (rendered as { children?: ReactNode }).children
  }
  return rendered as ReactNode
}

function rowIdentity<T extends object>(row: T, index: number, rowKey: TableProps<T>['rowKey']): string {
  if (typeof rowKey === 'function') return String(rowKey(row, index))
  if (typeof rowKey === 'string') return String(readValue(row, rowKey) ?? index)
  const record = row as Record<string, unknown>
  return String(record.key ?? record.id ?? index)
}

export default function ResponsiveTable<T extends object>({
  columns: sourceColumns,
  dataSource,
  rowKey,
  className,
  loading,
  pagination,
  locale,
  mobileTitleKey,
  mobileStatusKey,
  mobileHiddenKeys = [],
  mobileNoun = 'mục',
  onMobileCardClick,
  emptyText = 'Chưa có dữ liệu',
  ...tableProps
}: ResponsiveTableProps<T>) {
  const [mobilePage, setMobilePage] = useState(1)
  const rows = [...(dataSource ?? [])]
  const columns = flattenColumns(sourceColumns)
  const actionColumn = columns.find((column) => {
    const name = columnTitle(column).toLocaleLowerCase('vi-VN')
    return column.key === 'act' || column.key === 'actions' || name === 'thao tác' || name === 'actions'
  })
  const statusColumn = columns.find((column) =>
    (mobileStatusKey !== undefined && column.key === mobileStatusKey) ||
    (mobileStatusKey === undefined && (
      column.key === 'status' || columnTitle(column).toLocaleLowerCase('vi-VN') === 'trạng thái'
    )),
  )
  const titleColumn = columns.find((column) => {
    if (column.key === mobileTitleKey || ('dataIndex' in column && column.dataIndex === mobileTitleKey)) return true
    if (mobileTitleKey !== undefined) return false
    const title = columnTitle(column).toLocaleLowerCase('vi-VN')
    return title !== 'thao tác' && title !== 'actions' && title !== 'trạng thái' && title !== 'ảnh' && title !== 'image'
  }) ?? columns[0]
  const mediaColumn = columns.find((column) =>
    column !== titleColumn && /ảnh|image|avatar|photo|hình/i.test(columnTitle(column)),
  )
  const mobileColumns = columns.filter((column) =>
    column !== titleColumn &&
    column !== mediaColumn &&
    column !== statusColumn &&
    column !== actionColumn &&
    !mobileHiddenKeys.includes(String(column.key ?? column.dataIndex ?? '')),
  )
  const paginationOptions = pagination && typeof pagination === 'object' ? pagination : {}
  const mobilePageSize = pagination === false ? rows.length || 1 : paginationOptions.pageSize ?? 10
  const mobileTotal = pagination === false ? rows.length : paginationOptions.total ?? rows.length
  const mobileCurrent = paginationOptions.current ?? mobilePage
  const mobileRows = pagination === false
    ? rows
    : rows.length > mobilePageSize
      ? rows.slice((mobileCurrent - 1) * mobilePageSize, mobileCurrent * mobilePageSize)
      : rows
  const mobileLocaleEmpty = locale?.emptyText
  const resolvedEmptyText = typeof mobileLocaleEmpty === 'string' ? mobileLocaleEmpty : emptyText

  return (
    <>
      <Table<T>
        {...tableProps}
        columns={columns}
        dataSource={rows}
        rowKey={rowKey}
        loading={loading}
        pagination={pagination}
        locale={locale}
        className={['desktop-only', className].filter(Boolean).join(' ')}
      />
      <div className="responsive-table-mobile">
        <MobileCards
          rows={mobileRows}
          rowKey={(row, index) => rowIdentity(row, index, rowKey)}
          loading={Boolean(loading)}
          emptyText={resolvedEmptyText}
          onCardClick={onMobileCardClick}
          renderCard={(row, index) => {
            const title = titleColumn ? cellValue(titleColumn, row, index) : null
            const media = mediaColumn ? cellValue(mediaColumn, row, index) : null
            const status = statusColumn ? cellValue(statusColumn, row, index) : null
            const actions = actionColumn ? cellValue(actionColumn, row, index) : null
            return (
              <>
                <div className="mobile-card-head responsive-table-head">
                  <div className="responsive-table-title-group">
                    {media != null && <span className="responsive-table-media">{media}</span>}
                    <div className="mobile-card-title min-w-0">{title ?? '—'}</div>
                  </div>
                  {status}
                </div>
                {mobileColumns.length > 0 && (
                  <div className="mobile-card-rows">
                    {mobileColumns.map((column, columnIndex) => {
                      const value = cellValue(column, row, index)
                      if (value == null || value === '') return null
                      const label = columnTitle(column)
                      if (!label) return <div key={String(column.key ?? columnIndex)}>{value}</div>
                      return <MobileCardRow key={String(column.key ?? columnIndex)} label={label} value={value} />
                    })}
                  </div>
                )}
                {actions != null && <div className="mobile-card-actions responsive-table-actions">{actions}</div>}
              </>
            )
          }}
        />
      </div>
      {pagination !== false && mobileTotal > mobilePageSize && (
        <ListPagination
          page={mobileCurrent}
          limit={mobilePageSize}
          total={mobileTotal}
          noun={mobileNoun}
          onChange={(nextPage) => {
            setMobilePage(nextPage)
            paginationOptions.onChange?.(nextPage, mobilePageSize)
          }}
        />
      )}
    </>
  )
}
