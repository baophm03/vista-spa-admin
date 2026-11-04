import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type ProductModalProps = ModalProps & { children?: ReactNode }

export default function ProductModal({ children, ...props }: ProductModalProps) {
  return <Modal {...props}>{children}</Modal>
}
