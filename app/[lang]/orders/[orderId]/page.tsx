import OrderDetailPage from '@/ui/pages/OrderDetailPage'

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <OrderDetailPage orderId={orderId} />
}
