import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type StaffModalProps = ModalProps & { children?: ReactNode }

export default function StaffModal({ children, ...props }: StaffModalProps) {
  return <Modal {...props}>{children}</Modal>
}
