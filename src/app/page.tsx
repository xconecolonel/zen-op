import { supabase } from '@/lib/supabase'
import VehicleDashboard from '@/components/vehicle-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Vehicle = {
  id: number
  license_plate: string
  brand: string | null
  model: string | null
  mileage: number | null
  next_service_km: number | null
  parking_location: string | null
  status: string | null
  bodywork_status: string | null
  notes: string | null
  is_archived?: boolean | null
  archived_at?: string | null
  archive_reason?: string | null
}

export default async function Home() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('id', { ascending: true })

  const vehicles = (data || []) as Vehicle[]

  if (error) {
    return (
      <main className="min-h-screen bg-[#111111] p-6 text-white">
        <h1 className="mb-6 text-3xl font-bold">Zen OP — Flotte véhicules</h1>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          Erreur Supabase : {error.message}
        </div>
      </main>
    )
  }

  return <VehicleDashboard vehicles={vehicles} />
}