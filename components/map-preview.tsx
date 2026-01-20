import { Loader2, MapPin, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MapPreviewProps {
  coordinates: {
    lat: number
    lng: number
  }
  label?: string
  timestampLabel?: string
  className?: string
  onRefresh?: () => void
  isLoading?: boolean
  statusTag?: string
}

export function MapPreview({
  coordinates,
  label,
  timestampLabel,
  className,
  onRefresh,
  isLoading,
  statusTag,
}: MapPreviewProps) {
  const safeCoordinates = {
    lat: Number.isFinite(coordinates.lat) ? coordinates.lat : 0,
    lng: Number.isFinite(coordinates.lng) ? coordinates.lng : 0,
  }
  const mapSrc = `https://www.google.com/maps?q=${safeCoordinates.lat},${safeCoordinates.lng}&z=16&output=embed`

  return (
    <div
      className={cn(
        'relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-white',
        className,
      )}
    >
      <iframe title="map preview" src={mapSrc} className="h-full w-full" allowFullScreen loading="lazy" />
      <div className="absolute inset-x-4 top-4 flex items-center justify-between rounded-xl bg-white/95 p-3 shadow-sm">
        <div>
          {label && <p className="text-sm font-semibold text-foreground">{label}</p>}
          <p className="text-xs text-muted-foreground">
            {timestampLabel || 'GPS coordinate preview'}
          </p>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              {safeCoordinates.lat.toFixed(4)}, {safeCoordinates.lng.toFixed(4)}
            </span>
            {statusTag && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{statusTag}</span>}
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Refresh</span>
          </button>
        )}
      </div>
    </div>
  )
}
