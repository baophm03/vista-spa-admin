import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type TreatmentCustomerModalProps = ModalProps & { children?: ReactNode }

export default function TreatmentCustomerModal({ children, ...props }: TreatmentCustomerModalProps) {
  return <Modal {...props}>{children}</Modal>
}
