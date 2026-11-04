import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type CardRankModalProps = ModalProps & { children?: ReactNode }

export default function CardRankModal({ children, ...props }: CardRankModalProps) {
  return <Modal {...props}>{children}</Modal>
}
