import TaskDetailPage from '@/ui/pages/TaskDetailPage'

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  return <TaskDetailPage taskId={taskId} />
}
