'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, X, AlertCircle } from 'lucide-react'
import { CardSkeleton, TableRowSkeleton, ErrorState } from './skeleton-loader'
import { useLocale } from '@/components/providers/locale-provider'
import { fetchInventory, updateInventory } from '@/lib/api'

interface InventoryRecord {
  id: string
  name: string
  type: 'BOUQUET' | 'MATERIAL'
  image?: string
  unit?: string
  onHand: number
  reserved: number
  status: 'ok' | 'low' | 'out'
  lastUpdated: string
}

export default function InventoryView() {
  const { t } = useLocale()
  const [tab, setTab] = useState<'bouquets' | 'materials'>('bouquets')
  const [searchQuery, setSearchQuery] = useState('')
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adjustItemName, setAdjustItemName] = useState('')
  const [quantityChange, setQuantityChange] = useState(0)
  const [adjustItemType, setAdjustItemType] = useState<'BOUQUET' | 'MATERIAL'>('BOUQUET')
  const [inventory, setInventory] = useState<InventoryRecord[]>([])

  const bouquets = inventory.filter(item => item.type === 'BOUQUET')
  const materials = inventory.filter(item => item.type === 'MATERIAL')

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const data = await fetchInventory()
      setInventory(data)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-200'
      case 'low':
        return 'bg-amber-50 border-amber-200'
      case 'out':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-muted border-border'
    }
  }

  const getAvailabilityTone = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      case 'low':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'out':
        return 'bg-red-50 text-red-700 border border-red-200'
      default:
        return 'bg-muted text-foreground border border-border'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok':
        return 'In Stock'
      case 'low':
        return 'Low Stock'
      case 'out':
        return 'Out of Stock'
      default:
        return 'Unknown'
    }
  }

  const renderAvailability = (available: number, status: string) => (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(status)}`}
      title={getStatusLabel(status)}
    >
      <span>{available}</span>
      {status !== 'ok' && <AlertCircle className="h-4 w-4" aria-hidden />}
    </span>
  )

  const getStatusFromAvailable = (available: number) => {
    if (available <= 0) return 'out'
    if (available < 5) return 'low'
    return 'ok'
  }

  const updateInventoryTimestamp = async (
    type: 'BOUQUET' | 'MATERIAL',
    name: string,
    delta: number,
  ) => {
    const existing = inventory.find((item: InventoryRecord) => item.name.toLowerCase() === name.toLowerCase())

    const payload = existing ? {
      ...existing,
      onHand: Math.max(0, existing.onHand + delta)
    } : {
      id: `item-${Date.now()}`,
      type,
      name,
      onHand: Math.max(0, delta),
      reserved: 0,
      unit: type === 'BOUQUET' ? 'arrangement' : 'unit'
    }

    try {
      await updateInventory(payload)
      await loadInventory()
    } catch (err) {
      console.error('Failed to update inventory:', err)
      alert('Failed to update inventory')
    }
  }

  const handleSaveAdjustment = () => {
    const normalizedName = adjustItemName.trim()
    if (!normalizedName) {
      setAdjustmentOpen(false)
      return
    }

    updateInventoryTimestamp(adjustItemType, normalizedName, quantityChange)
    setAdjustmentOpen(false)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4 md:p-8 pb-24 md:pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">{t('inventory.title', 'Inventory')}</h2>
            <p className="text-muted-foreground">{t('inventory.subtitle', 'Manage bouquets and materials')}</p>
          </div>
          <ErrorState message={t('inventory.loadError', 'Failed to load inventory. Please refresh the page.')} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4 md:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{t('inventory.title', 'Inventory')}</h2>
            <p className="text-muted-foreground">{t('inventory.subtitle', 'Manage bouquets and materials')}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('inventory.searchPlaceholder', 'Search items...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => {
                setAdjustItemType(tab === 'bouquets' ? 'BOUQUET' : 'MATERIAL')
                setAdjustItemName('')
                setQuantityChange(0)
                setAdjustmentOpen(true)
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('inventory.addNewItem', 'Add New Item')}
            </button>
            <button
              onClick={() => {
                setAdjustItemType(tab === 'bouquets' ? 'BOUQUET' : 'MATERIAL')
                setQuantityChange(0)
                setAdjustmentOpen(true)
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('inventory.addAdjustment', 'Add Stock Adjustment')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border">
          <button
            onClick={() => setTab('bouquets')}
            className={`px-4 py-3 font-medium transition-colors ${tab === 'bouquets'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {t('inventory.tab.bouquets', 'Bouquets')}
          </button>
          <button
            onClick={() => setTab('materials')}
            className={`px-4 py-3 font-medium transition-colors ${tab === 'materials'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {t('inventory.tab.materials', 'Materials')}
          </button>
        </div>

        {/* Bouquets Tab */}
        {tab === 'bouquets' && (
          <div className="space-y-4">
            {/* Desktop View - Table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
              <table className="w-full">
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Item</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Available</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Last Updated</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                    </>
                  ) : (
                    bouquets.map((bouquet) => (
                      <tr key={bouquet.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex gap-3 items-center">
                            <img
                              src={bouquet.image || "/placeholder.svg"}
                              alt={bouquet.name}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <span className="font-medium text-foreground">{bouquet.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-foreground">
                          {renderAvailability(bouquet.onHand - bouquet.reserved, bouquet.status)}
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground text-sm">
                          {new Date(bouquet.lastUpdated).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              setAdjustItemType('BOUQUET')
                              setAdjustItemName(bouquet.name)
                              setAdjustmentOpen(true)
                              setQuantityChange(0)
                            }}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-muted"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards */}
            <div className="grid gap-4 md:hidden">
              {loading ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                bouquets.map((bouquet) => (
                  <div
                    key={bouquet.id}
                    className={`rounded-xl border-2 p-4 ${getStatusColor(bouquet.status)}`}
                  >
                    <div className="flex gap-3 mb-3">
                      <img
                        src={bouquet.image || "/placeholder.svg"}
                        alt={bouquet.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{bouquet.name}</h3>
                        {renderAvailability(bouquet.onHand - bouquet.reserved, bouquet.status)}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Updated {new Date(bouquet.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => {
                          setAdjustItemType('BOUQUET')
                          setAdjustItemName(bouquet.name)
                          setAdjustmentOpen(true)
                          setQuantityChange(0)
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-white"
                      >
                        Adjust stock
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Materials Tab */}
        {tab === 'materials' && (
          <div className="space-y-4">
            {/* Desktop View - Table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
              <table className="w-full">
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Material</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Available</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Last Updated</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                    </>
                  ) : (
                    materials.map((material) => (
                      <tr key={material.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">{material.name}</td>
                        <td className="px-6 py-4 text-center font-medium text-foreground">
                          {renderAvailability(material.onHand - material.reserved, material.status)}
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground text-sm">
                          {new Date(material.lastUpdated).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              setAdjustItemType('MATERIAL')
                              setAdjustItemName(material.name)
                              setAdjustmentOpen(true)
                              setQuantityChange(0)
                            }}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-muted"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards */}
            <div className="grid gap-4 md:hidden">
              {loading ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                materials.map((material) => (
                  <div
                    key={material.id}
                    className={`rounded-xl border-2 p-4 ${getStatusColor(material.status)}`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{material.name}</h3>
                        <p className="text-xs text-muted-foreground">{material.unit}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Updated {new Date(material.lastUpdated).toLocaleString()}</p>
                      </div>
                      {renderAvailability(material.onHand - material.reserved, material.status)}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => {
                          setAdjustItemType('MATERIAL')
                          setAdjustItemName(material.name)
                          setAdjustmentOpen(true)
                          setQuantityChange(0)
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-white"
                      >
                        Adjust stock
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Add Stock Adjustment Modal */}
        {adjustmentOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/20">
            <div className="w-full md:w-full md:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl md:rounded-2xl border border-border bg-white">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 rounded-t-2xl md:rounded-t-2xl flex-shrink-0">
                <h3 className="text-lg font-semibold text-foreground">Add Stock Adjustment</h3>
                <button
                  onClick={() => setAdjustmentOpen(false)}
                  className="rounded-lg p-1 hover:bg-muted"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="space-y-4 p-6">
                  <div>
                    <label className="text-sm font-medium text-foreground">Item Type</label>
                    <select
                      value={adjustItemType}
                      onChange={(event) => setAdjustItemType(event.target.value as 'BOUQUET' | 'MATERIAL')}
                      className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Bouquet">Bouquet</option>
                      <option value="Material">Material</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Item</label>
                    <input
                      list="inventory-items"
                      value={adjustItemName}
                      onChange={(event) => setAdjustItemName(event.target.value)}
                      placeholder="Search item name"
                      className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <datalist id="inventory-items">
                      {[...bouquets, ...materials].map((item) => (
                        <option key={item.id} value={item.name}></option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Quantity Change</label>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantityChange((prev) => Math.max(0, prev - 1))}
                        className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium hover:bg-border"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={quantityChange}
                        onChange={(event) => setQuantityChange(Math.max(0, Number(event.target.value)))}
                        className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantityChange((prev) => prev + 1)}
                        className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium hover:bg-border"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Reason</label>
                    <select className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Purchase</option>
                      <option>Adjustment</option>
                      <option>Reserve Fix</option>
                      <option>Consume Fix</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Notes</label>
                    <textarea
                      placeholder="Optional notes..."
                      className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setAdjustmentOpen(false)}
                      className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAdjustment}
                      className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
                    >
                      Save Adjustment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
