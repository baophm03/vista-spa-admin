import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface LuckyWheelModalsProps extends ModalProps {
  content?: ReactNode
}

export default function LuckyWheelModals({ content, children, ...props }: LuckyWheelModalsProps) {
  return <Modal {...props}>{content ?? children}</Modal>
}
