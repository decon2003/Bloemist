'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { TaskCardSkeleton, StatsCardSkeleton, ErrorState } from './skeleton-loader'

interface Task {
  id: string
  title: string
  description: string
  deadline: string
  status: 'pending' | 'in-progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
}

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Wedding Bouquet - Johnson',
    description: 'Red roses with white limonium',
    deadline: '2:00 PM',
    status: 'in-progress',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Birthday Arrangement - Smith',
    description: 'Mixed seasonal flowers',
    deadline: '3:30 PM',
    status: 'pending',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Corporate Event Flowers',
    description: 'Table centerpieces (x10)',
    deadline: '4:00 PM',
    status: 'pending',
    priority: 'medium',
  },
  {
    id: '4',
    title: 'Sympathy Arrangement - Brown',
    description: 'White lilies and roses',
    deadline: '1:00 PM',
    status: 'completed',
    priority: 'high',
  },
  {
    id: '5',
    title: 'Graduation Bouquet',
    description: 'Yellow sunflowers with greenery',
    deadline: '5:00 PM',
    status: 'pending',
    priority: 'low',
  },
]

export default function FloristTasks() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all')
  const [showAddTask, setShowAddTask] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  const filteredTasks = tasks.filter((task) => filter === 'all' || task.status === filter)

  const updateTaskStatus = (id: string, status: Task['status']) => {
    setTasks(tasks.map((task) => (task.id === id ? { ...task, status } : task)))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id))
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-primary" />
      case 'in-progress':
        return <Clock className="h-5 w-5 text-secondary" />
      default:
        return <AlertCircle className="h-5 w-5 text-accent" />
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-destructive'
      case 'medium':
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-green-100 text-green-700'
    }
  }

  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">My Tasks</h2>
          <p className="text-muted-foreground">Manage your daily flower arrangements</p>
        </div>
        <ErrorState message="Failed to load tasks. Please refresh the page." />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">My Tasks</h2>
        <p className="text-muted-foreground">Manage your daily flower arrangements</p>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-3">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <div className="flex-shrink-0 snap-center rounded-xl border border-border bg-white p-4 md:flex-shrink">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-accent">{stats.pending}</p>
            </div>
            <div className="flex-shrink-0 snap-center rounded-xl border border-border bg-white p-4 md:flex-shrink">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-secondary">{stats.inProgress}</p>
            </div>
            <div className="flex-shrink-0 snap-center rounded-xl border border-border bg-white p-4 md:flex-shrink">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-primary">{stats.completed}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'in-progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary text-white'
                : 'border border-border bg-white text-foreground hover:bg-muted'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {loading ? (
          <>
            <TaskCardSkeleton />
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center">
            <p className="text-muted-foreground">No tasks in this category</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex flex-1 items-start gap-3">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{task.title}</h3>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {task.deadline}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {task.status !== 'completed' && (
                  <>
                    {task.status === 'pending' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'in-progress')}
                        className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-opacity-80 transition-colors"
                      >
                        Start
                      </button>
                    )}
                    {task.status === 'in-progress' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Task Button */}
      <button
        onClick={() => setShowAddTask(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Add task"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/20">
          <div className="w-full md:w-full md:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl md:rounded-2xl border border-border bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 rounded-t-2xl md:rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-semibold text-foreground">Add New Task</h3>
              <button
                onClick={() => setShowAddTask(false)}
                className="rounded-lg p-1 hover:bg-muted"
                aria-label="Close modal"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="space-y-4 p-6">
                <div>
                  <label className="text-sm font-medium text-foreground">Task Title</label>
                  <input
                    type="text"
                    placeholder="Enter task title..."
                    className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <textarea
                    placeholder="Enter task description..."
                    className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Deadline</label>
                  <input
                    type="time"
                    className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Priority</label>
                  <select className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowAddTask(false)}
                    className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowAddTask(false)}
                    className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
