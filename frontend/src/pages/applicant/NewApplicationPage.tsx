import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../context/AuthContext'
import { applicationApi, planTypeApi, feeApi, paymentApi, taxApi, documentApi } from '../../api'
import { Button, Field, Alert, Spinner, FileUpload, useToast } from '../../components/ui'
import { cx, fmtRs, validateNIC, validatePhone, getErrorMsg } from '../../utils'

const PLAN_CATEGORIES = [
  {
    id: 'BUILDING_PLAN',
    label: 'Building Plan',
    icon: '🏗️',
    color: 'border-ps-500 bg-ps-50',
    description: 'Residential, commercial, or industrial building construction',
  },
  {
    id: 'PLOT_OF_LAND',
    label: 'Plot of Land',
    icon: '🌏',
    color: 'border-emerald-500 bg-emerald-50',
    description: 'Whole land approval or land subdivision',
  },
  {
    id: 'BOUNDARY_WALL',
    label: 'Boundary Wall',
    icon: '🧱',
    color: 'border-amber-500 bg-amber-50',
    description: 'Standard or RDA road boundary wall construction',
  },
]

const SUBTYPES: Record<string, any[]> = {
  BUILDING_PLAN: [
    {
      id: 'residential', label: 'Residential House',
      icon: '🏠', desc: 'Single or multi-family residential buildings',
      baseFee: 5000, rateLabel: 'Rs. 20–25/sq.m',
      docs: ['Architectural plans (3 copies)', 'Structural plans', 'Water Board clearance', 'Approved land boundary plan'],
      fields: ['building', 'single_story'],
    },
    {
      id: 'residential-commercial', label: 'Residential & Commercial',
      icon: '🏬', desc: 'Mixed-use shop house buildings',
      baseFee: 8000, rateLabel: 'Rs. 25–27/sq.m',
      docs: ['Architectural plans (3 copies)', 'Structural plans', 'Water Board clearance', 'Business registration', 'Letter of intent'],
      fields: ['building', 'multi_story'],
    },
    {
      id: 'commercial', label: 'Commercial Building',
      icon: '🏢', desc: 'Pure commercial shops, offices, businesses',
      baseFee: 10000, rateLabel: 'Rs. 25–32/sq.m',
      docs: ['Architectural plans (3 copies)', 'Structural plans', 'Business registration', 'EIA (if applicable)', 'Fire safety plan'],
      fields: ['building', 'multi_story'],
    },
    {
      id: 'industrial', label: 'Industrial / Warehouse',
      icon: '🏭', desc: 'Industrial facilities, warehouses, storage',
      baseFee: 15000, rateLabel: 'Rs. 25–32/sq.m',
      docs: ['Industrial plan with machinery layout', 'Fire safety plan (mandatory)', 'EIA (mandatory)', 'Business registration', 'Health Officer clearance'],
      fields: ['building', 'industrial'],
      needsHO: true,
    },
  ],
  PLOT_OF_LAND: [
    {
      id: 'whole-land', label: 'Whole Land Approval',
      icon: '🗺️', desc: 'Approval for entire plot of land',
      baseFee: 3000, rateLabel: 'Configurable/perch',
      docs: ['Land title deed', 'Certified survey plan', 'Assessment tax receipt', 'NIC copy'],
      fields: ['plot_whole'],
    },
    {
      id: 'subdivided', label: 'Subdivided Plots',
      icon: '✂️', desc: 'Divide land into smaller plots',
      baseFee: 5000, rateLabel: 'Rs. 500–1,000/plot',
      docs: ['Previously approved whole land plan', 'Subdivision survey plan', 'Land title deed', 'Proof of whole land approval'],
      fields: ['plot_subdivided'],
      prerequisite: 'Requires prior whole land approval',
    },
  ],
  BOUNDARY_WALL: [
    {
      id: 'standard-wall', label: 'Standard Boundary Wall',
      icon: '🧱', desc: 'Boundary wall on private property',
      baseFee: 2000, rateLabel: 'Rs. 100/linear meter',
      docs: ['Boundary survey plan', 'Land title deed', 'Neighbor consent (if applicable)', 'Wall design specifications'],
      fields: ['wall'],
    },
    {
      id: 'rda-wall', label: 'Wall Near RDA Roads',
      icon: '🛣️', desc: 'Walls within distance of RDA roads',
      baseFee: 3000, rateLabel: 'Rs. 100/linear meter',
      docs: ['Boundary survey plan', 'Land title deed', 'RDA waiver agreement', 'Wall design specifications'],
      fields: ['wall'],
      needsRDA: true,
    },
  ],
}

type Step = 'type' | 'subtype' | 'details' | 'documents' | 'payment' | 'done'

const NewApplicationPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { show: toast, ToastContainer } = useToast()

  const [step, setStep]             = useState<Step>('type')
  const [category, setCategory]     = useState<string>('')
  const [subtype, setSubtype]       = useState<any>(null)
  const [applicationId, setApplicationId] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [calcFee, setCalcFee]       = useState<number | null>(null)
  const [documents, setDocuments]   = useState<File[]>([])
  const [paymentDone, setPaymentDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const steps: { key: Step; label: string }[] = [
    { key: 'type',      label: 'Plan Type' },
    { key: 'subtype',   label: 'Sub-type' },
    { key: 'details',   label: 'Details' },
    { key: 'documents', label: 'Documents' },
    { key: 'payment',   label: 'Payment' },
    { key: 'done',      label: 'Submitted' },
  ]

  const currentStep = steps.findIndex(s => s.key === step)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <ToastContainer />

      {/* Header */}
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 mb-3 text-sm text-slate-500 hover:text-slate-700">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900">New Planning Application</h1>
        <p className="mt-1 text-sm text-slate-500">Kelaniya Pradeshiya Sabha — Planning Approval</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={cx('step-indicator',
                i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'
              )}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className={cx('text-[10px] font-medium', i <= currentStep ? 'text-ps-700' : 'text-slate-400')}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cx('flex-1 h-0.5 mx-2 mb-4', i < currentStep ? 'bg-ps-600' : 'bg-slate-200')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="p-6 card">
        {step === 'type' && (
          <TypeStep
            selected={category}
            onSelect={c => { setCategory(c); setSubtype(null); setStep('subtype') }}
          />
        )}

        {step === 'subtype' && category && (
          <SubtypeStep
            category={category}
            selected={subtype}
            onSelect={st => setSubtype(st)}
            onBack={() => setStep('type')}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'details' && subtype && (
          <DetailsStep
            category={category}
            subtype={subtype}
            onBack={() => setStep('subtype')}
            onNext={(appId, refNum, fee) => {
              setApplicationId(appId)
              setReferenceNumber(refNum)
              setCalcFee(fee)
              setStep('documents')
            }}
            toast={toast}
          />
        )}

        {step === 'documents' && (
          <DocumentsStep
            applicationId={applicationId}
            required={subtype?.docs ?? []}
            files={documents}
            onChange={setDocuments}
            onBack={() => setStep('details')}
            onNext={async () => {
              if (documents.length > 0) {
                const fd = new FormData()
                documents.forEach(f => fd.append('documents', f))
                try {
                  await documentApi.upload(applicationId, fd)
                } catch { /* non-fatal */ }
              }
              setStep('payment')
            }}
          />
        )}

        {step === 'payment' && (
          <PaymentStep
            referenceNumber={referenceNumber}
            amount={calcFee ?? 200}
            onBack={() => setStep('documents')}
            onDone={() => { setPaymentDone(true); setStep('done') }}
            toast={toast}
          />
        )}

        {step === 'done' && (
          <DoneStep referenceNumber={referenceNumber} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

// ── Step 1: Plan Type ─────────────────────────────────────────────────────────
const TypeStep: React.FC<{ selected: string; onSelect: (c: string) => void }> = ({ selected, onSelect }) => (
  <div>
    <h2 className="mb-1 text-xl font-bold text-slate-900">Select Plan Type</h2>
    <p className="mb-6 text-sm text-slate-500">Choose the primary category of your planning application</p>
    <div className="grid gap-4">
      {PLAN_CATEGORIES.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cx(
            'flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all hover:shadow-md',
            selected === c.id ? c.color + ' border-opacity-100' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <span className="text-4xl">{c.icon}</span>
          <div>
            <div className="font-bold text-slate-900">{c.label}</div>
            <div className="text-sm text-slate-500">{c.description}</div>
          </div>
          <div className="ml-auto text-2xl">{selected === c.id ? '✓' : '›'}</div>
        </button>
      ))}
    </div>
  </div>
)

// ── Step 2: Sub-type ──────────────────────────────────────────────────────────
const SubtypeStep: React.FC<{
  category: string; selected: any; onSelect: (s: any) => void; onBack: () => void; onNext: () => void
}> = ({ category, selected, onSelect, onBack, onNext }) => {
  const subtypes = SUBTYPES[category] ?? []
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-slate-900">Select Sub-Type</h2>
      <p className="mb-6 text-sm text-slate-500">Choose the specific type for your application</p>
      <div className="grid gap-4 mb-6 sm:grid-cols-2">
        {subtypes.map(st => (
          <button
            key={st.id}
            onClick={() => onSelect(st)}
            className={cx(
              'p-5 rounded-xl border-2 text-left transition-all hover:shadow-md flex flex-col gap-3',
              selected?.id === st.id ? 'border-ps-500 bg-ps-50' : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{st.icon}</span>
              <div>
                <div className="font-bold text-slate-900">{st.label}</div>
                <div className="text-xs text-slate-500">{st.desc}</div>
              </div>
              {selected?.id === st.id && <span className="ml-auto text-ps-600">✓</span>}
            </div>
            {st.prerequisite && (
              <div className="px-2 py-1 text-xs rounded-lg text-amber-600 bg-amber-50">{st.prerequisite}</div>
            )}
            <div className="mt-auto">
              <div className="mb-1 text-xs text-slate-400">Required documents:</div>
              <ul className="text-xs text-slate-600 space-y-0.5">
                {st.docs.slice(0, 3).map((d: string, i: number) => <li key={i}>• {d}</li>)}
                {st.docs.length > 3 && <li className="text-slate-400">+{st.docs.length - 3} more</li>}
              </ul>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">Base fee</span>
              <span className="text-sm font-bold text-ps-700">Rs. {st.baseFee.toLocaleString()} + {st.rateLabel}</span>
            </div>
            {(st.needsHO || st.needsRDA) && (
              <div className="flex gap-2">
                {st.needsHO && <span className="text-xs badge-yellow">Health Officer Required</span>}
                {st.needsRDA && <span className="text-xs badge-red">RDA Approval Required</span>}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext} disabled={!selected}>
          Continue to Details →
        </Button>
      </div>
    </div>
  )
}

// ── Step 3: Application Details ───────────────────────────────────────────────
const DetailsStep: React.FC<{
  category: string; subtype: any;
  onBack: () => void;
  onNext: (appId: string, ref: string, fee: number) => void;
  toast: Function;
}> = ({ category, subtype, onBack, onNext, toast }) => {
  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<any>()
  const [loading, setLoading]   = useState(false)
  const [taxInfo, setTaxInfo]   = useState<any>(null)
  const [taxLoading, setTaxLoading] = useState(false)
  const [calcFee, setCalcFee]   = useState<number | null>(null)

  const { data: planTypesData } = useQuery('plan-types', planTypeApi.list)
  const planTypes: any[] = planTypesData?.data?.data ?? planTypesData?.data ?? []
  const matchingPlanType = planTypes.find(pt =>
    pt.category === category && pt.subtype?.toLowerCase().includes(subtype.id.split('-')[0])
  ) ?? planTypes.find(pt => pt.category === category)

  const area = watch('building_area') || watch('site_area') || watch('wall_length')
  const storyType = watch('story_type')

  // Fee calculation on area change
  useEffect(() => {
    console.log("inside calca useeffect");
    if (!area || !matchingPlanType) return
    const timeout = setTimeout(async () => {
      try {
        let res
        if (category === 'BUILDING_PLAN') {
          res = await feeApi.calculateBuilding({ plan_type_id: matchingPlanType.plan_type_id, sqm: parseFloat(area), story_type: storyType || 'SINGLE_STORY' })
        } else if (category === 'PLOT_OF_LAND') {
          res = await feeApi.calculatePlot({ plan_type_id: matchingPlanType.plan_type_id, perches: parseFloat(area), is_subdivided: subtype.id === 'subdivided' })
        } else {
          res = await feeApi.calculateWall({ plan_type_id: matchingPlanType.plan_type_id, length_metres: parseFloat(area) })
        }
        const fee = res.data?.data?.fee ?? res.data?.fee
        console.log("response of fee",res);
        setCalcFee(fee)
      } catch { 
        console.log("calc fee catch")
       }
    }, 500)
    return () => clearTimeout(timeout)
  }, [area, storyType, category, subtype?.id, matchingPlanType?.plan_type_id])

  const lookupTax = async (taxNumber: string) => {
    if (!taxNumber.trim()) return
    setTaxLoading(true)
    try {
      const res = await taxApi.psoLookup(taxNumber)
      setTaxInfo(res.data?.data ?? res.data)
    } catch { setTaxInfo(null) }
    finally { setTaxLoading(false) }
  }

  const onSubmit = async (data: any) => {
    if (!matchingPlanType) { toast('Plan type not found', 'error'); return }
    setLoading(true)
    try {
      const payload: any = {
        plan_type_id:    matchingPlanType.plan_type_id,
        sub_plan_type:   subtype.id,
        submission_mode: 'ONLINE',
        work_type:       data.work_type || 'NEW_CONSTRUCTION',
        proposed_use:    data.proposed_use || 'RESIDENTIAL',
        existing_use:    data.existing_use || 'RESIDENTIAL',
        land_ownership_type: data.land_ownership_type,
        // Land details
        site_area:        data.site_area ? parseFloat(data.site_area) : undefined,
        building_area:    data.building_area ? parseFloat(data.building_area) : undefined,
        wall_length:      data.wall_length ? parseFloat(data.wall_length) : undefined,
        building_floors:  data.building_floors ? parseInt(data.building_floors) : undefined,
        building_height_m: data.building_height_m ? parseFloat(data.building_height_m) : undefined,
        floor_height_m:    data.floor_height_m ? parseFloat(data.floor_height_m) : undefined,
        story_type:       data.story_type,
        // Materials
        wall_material:    data.wall_material,
        roof_material:    data.roof_material,
        floor_material:   data.floor_material,
        // Setbacks
        distance_to_road_centre_m:   data.dist_road ? parseFloat(data.dist_road) : undefined,
        distance_to_rear_boundary_m: data.dist_rear ? parseFloat(data.dist_rear) : undefined,
        distance_to_right_boundary_m:data.dist_right ? parseFloat(data.dist_right) : undefined,
        distance_to_left_boundary_m: data.dist_left ? parseFloat(data.dist_left) : undefined,
        // Road
        access_road_width: data.road_width,
        access_road_ownership: data.road_ownership,
        // Land nature
        land_nature:      data.land_nature,
        subdivision_plan_approved: data.subdivision_plan_approved === 'true',
        subdivision_plan_ref: data.subdivision_plan_ref,
        // Waste
        wastewater_disposal: data.wastewater,
        rainwater_disposal:  data.rainwater,
        solid_waste_disposal:data.solid_waste,
        // Professional
        professional_name:        data.prof_name,
        professional_designation: data.prof_designation,
        professional_phone:       data.prof_phone,
        professional_reg_number:  data.prof_reg,
        // Construction desc
        construction_description: data.description,
        // Location
        map_lat:              data.map_lat ? parseFloat(data.map_lat) : undefined,
        map_lng:              data.map_lng ? parseFloat(data.map_lng) : undefined,
        map_place_description:data.place_description,
        previous_plan_number: data.previous_plan_number,
        // Floor breakdown
        ground_floor_area:  data.ground_floor_area ? parseFloat(data.ground_floor_area) : undefined,
        basement_area:       data.basement_area ? parseFloat(data.basement_area) : undefined,
        first_floor_area:    data.first_floor_area ? parseFloat(data.first_floor_area) : undefined,
        second_floor_area:   data.second_floor_area ? parseFloat(data.second_floor_area) : undefined,
        // Waste management
        waste_management_kitchen:   data.waste_management_kitchen   || undefined,
        waste_management_toilet:    data.waste_management_toilet    || undefined,
        waste_management_other:     data.waste_management_other     || undefined,
        waste_management_rainwater: data.waste_management_rainwater || undefined,
        // Tax
        tax_number: taxInfo?.tax_number,
        tax_record_id: taxInfo?.tax_record_id,
        // Declaration
        applicant_declaration_accepted: true,
        declaration_accepted_at: new Date(),
      }

      // Remove undefined
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      const res = await applicationApi.create(payload)
      const app = res.data?.data ?? res.data
      onNext(app.application_id, app.reference_number ?? app.application_id, calcFee ?? 200)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const isBuildingPlan = category === 'BUILDING_PLAN'
  const isPlot = category === 'PLOT_OF_LAND'
  const isWall = category === 'BOUNDARY_WALL'

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="mb-1 text-xl font-bold text-slate-900">Application Details</h2>
      <p className="mb-6 text-sm text-slate-500">Fill in the development details as per the physical application form</p>

      <div className="space-y-6">
        {/* Assessment Tax Number */}
        <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
          <h3 className="mb-3 font-semibold text-slate-800">Part II — Development Site</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assessment Tax Number">
              <div className="flex gap-2">
                <input
                  className="form-input"
                  placeholder="e.g. KEL/001/2024"
                  {...register('tax_number')}
                  onBlur={e => lookupTax(e.target.value)}
                />
                {taxLoading && <Spinner size="sm" className="mt-2 text-ps-600" />}
              </div>
              {taxInfo && (
                <p className="mt-1 text-xs text-emerald-600">✓ {taxInfo.property_address}</p>
              )}
            </Field>
            <Field label="Road Name">
              <input className="form-input" placeholder="Temple Road" {...register('road_name')} />
            </Field>
          </div>
        </div>

        {/* Reason & Work Type */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Work Type" required error={errors.work_type?.message as string}>
            <select className="form-input" {...register('work_type', { required: true })}>
              <option value="NEW_CONSTRUCTION">New Construction</option>
              <option value="RECONSTRUCTION">Reconstruction</option>
              <option value="ADDITION">Addition</option>
              <option value="ALTERATION">Alteration</option>
            </select>
          </Field>
          <Field label="Previous Plan Number" hint="Required if Addition/Alteration">
            <input className="form-input" placeholder="PS-2020-BP-00001" {...register('previous_plan_number')} />
          </Field>
        </div>

        {/* Proposed use */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Existing Use">
            <select className="form-input" {...register('existing_use')}>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INDUSTRIAL">Industrial</option>
              <option value="PUBLIC">Public</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Proposed Use" required>
            <select className="form-input" {...register('proposed_use', { required: true })}>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INDUSTRIAL">Industrial</option>
              <option value="PUBLIC">Public</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
        </div>

        {/* Land Details */}
        <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
          <h3 className="mb-3 font-semibold text-slate-800">Part II §5 — Land Details</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Land Size (Perches)" hint="Total land area">
              <input className="form-input" type="number" step="0.01" {...register('site_area')} placeholder="e.g. 20" />
            </Field>
            <Field label="Land Ownership">
              <select className="form-input" {...register('land_ownership_type')}>
                <option value="FREEHOLD">Freehold (Sinnakkara)</option>
                <option value="LEASE">Leasehold (Badu)</option>
                <option value="RENT">Rented (Kuli)</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Nature of Land">
              <select className="form-input" {...register('land_nature')}>
                <option value="">— Select —</option>
                <option value="HIGHLAND">High Land</option>
                <option value="FLAT">Level Land</option>
                <option value="LOW_LYING">Low Land</option>
                <option value="PADDY">Paddy Land</option>
                <option value="MARSHY">Marshy Land</option>
                <option value="SLOPED">Sloped Land</option>
                <option value="FLOOD_PRONE">Flood Prone</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Building-specific fields */}
        {isBuildingPlan && (
          <>
            <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
              <h3 className="mb-3 font-semibold text-slate-800">Part II §8 — Building Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Building Floor Area (sq.m)" required>
                  <input className="form-input" type="number" step="0.1" placeholder="e.g. 120"
                    {...register('building_area', { required: 'Building area is required' })}
                  />
                  {calcFee != null && (
                    <p className="mt-1 text-xs text-emerald-600">Estimated approval fee: {fmtRs(calcFee)}</p>
                  )}
                </Field>
                <Field label="Story Type">
                  <select className="form-input" {...register('story_type')}>
                    <option value="SINGLE_STORY">Single Story</option>
                    <option value="MULTI_STORY">Multi-Story</option>
                  </select>
                </Field>
                <Field label="Number of Floors">
                  <input className="form-input" type="number" min="1" {...register('building_floors')} />
                </Field>
                <Field label="Total Height (meters)">
                  <input className="form-input" type="number" step="0.1" {...register('building_height_m')} />
                </Field>
                <Field label="Height Between Floors (m)" hint="§8 — inter-floor height">
                  <input className="form-input" type="number" step="0.01" {...register('floor_height_m')} placeholder="e.g. 3.0" />
                </Field>
              </div>
            </div>

            <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
              <h3 className="mb-3 font-semibold text-slate-800">§9 — Construction Materials</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Walls Material">
                  <input className="form-input" placeholder="e.g. Brick" {...register('wall_material')} />
                </Field>
                <Field label="Roof Material">
                  <input className="form-input" placeholder="e.g. Tile" {...register('roof_material')} />
                </Field>
                <Field label="Floor Material">
                  <input className="form-input" placeholder="e.g. Tile" {...register('floor_material')} />
                </Field>
              </div>
            </div>

            {/* Floor Area Breakdown — PDF Part II §11 */}
            {(subtype?.id === 'residential' || subtype?.id === 'residential-commercial' || subtype?.id === 'commercial' || subtype?.id === 'industrial') && (
              <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
                <h3 className="mb-3 font-semibold text-slate-800">§11 — Building Floor Areas (sq.ft)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ground Floor Area (sq.ft)">
                    <input className="form-input" type="number" step="0.1" {...register('ground_floor_area')} placeholder="0.00" />
                  </Field>
                  <Field label="Basement Area (sq.ft)">
                    <input className="form-input" type="number" step="0.1" {...register('basement_area')} placeholder="0.00" />
                  </Field>
                  <Field label="1st Floor Area (sq.ft)">
                    <input className="form-input" type="number" step="0.1" {...register('first_floor_area')} placeholder="0.00" />
                  </Field>
                  <Field label="2nd Floor Area (sq.ft)">
                    <input className="form-input" type="number" step="0.1" {...register('second_floor_area')} placeholder="0.00" />
                  </Field>
                </div>
              </div>
            )}

            <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
              <h3 className="mb-3 font-semibold text-slate-800">§7 — Distance to Boundaries (Setbacks)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { name: 'dist_road',  label: 'From road centre (m)' },
                  { name: 'dist_rear',  label: 'From rear boundary (m)' },
                  { name: 'dist_right', label: 'From right boundary (m)' },
                  { name: 'dist_left',  label: 'From left boundary (m)' },
                ].map(f => (
                  <Field key={f.name} label={f.label}>
                    <input className="form-input" type="number" step="0.1" {...register(f.name as any)} />
                  </Field>
                ))}
              </div>
            </div>

            <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
              <h3 className="mb-3 font-semibold text-slate-800">§10 — Waste Management</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kitchen Waste" hint="e.g. Compost, Municipal collection">
                  <input className="form-input" {...register('waste_management_kitchen')} placeholder="e.g. Municipal collection" />
                </Field>
                <Field label="Toilet Waste" hint="e.g. Septic tank, Sewer">
                  <input className="form-input" {...register('waste_management_toilet')} placeholder="e.g. Septic tank + soak pit" />
                </Field>
                <Field label="Other Waste">
                  <input className="form-input" {...register('waste_management_other')} placeholder="e.g. Recycling" />
                </Field>
                <Field label="Rainwater" hint="e.g. Collection tank, Soakage pit">
                  <input className="form-input" {...register('waste_management_rainwater')} placeholder="e.g. Soakage pit" />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* Plot-specific */}
        {isPlot && (
          <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
            <h3 className="mb-3 font-semibold text-slate-800">Land Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={subtype.id === 'subdivided' ? 'Plot Size (Perches)' : 'Land Area (Perches)'} required>
                <input className="form-input" type="number" step="0.01" placeholder="e.g. 20"
                  {...register('site_area', { required: true })}
                />
                {calcFee != null && (
                  <p className="mt-1 text-xs text-emerald-600">Estimated fee: {fmtRs(calcFee)}</p>
                )}
              </Field>
              {subtype.id === 'subdivided' && (
                <>
                  <Field label="Previous Whole Land Plan Reference" required>
                    <input className="form-input" placeholder="PS-2020-PL-00001" {...register('subdivision_plan_ref')} />
                  </Field>
                  <Field label="Is Subdivision Plan Approved?">
                    <select className="form-input" {...register('subdivision_plan_approved')}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
          </div>
        )}

        {/* Wall-specific */}
        {isWall && (
          <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
            <h3 className="mb-3 font-semibold text-slate-800">Wall Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Wall Length (linear meters)" required>
                <input className="form-input" type="number" step="0.1" placeholder="e.g. 30"
                  {...register('wall_length', { required: true })}
                />
                {calcFee != null && (
                  <p className="mt-1 text-xs text-emerald-600">Estimated fee: {fmtRs(calcFee)}</p>
                )}
              </Field>
            </div>
          </div>
        )}

        {/* Access Road */}
        <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
          <h3 className="mb-3 font-semibold text-slate-800">§6 — Access Road</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Road Width (feet/meters)">
              <input className="form-input" {...register('road_width')} placeholder="e.g. 20 feet" />
            </Field>
            <Field label="Road Ownership">
              <select className="form-input" {...register('road_ownership')}>
                <option value="">— Select —</option>
                <option value="RDA">RDA</option>
                <option value="PROVINCIAL_RDA">Provincial RDA</option>
                <option value="LOCAL_AUTHORITY">Local Authority</option>
                <option value="PRIVATE">Private</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Professional Details */}
        <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
          <h3 className="mb-3 font-semibold text-slate-800">Part I §5 — Architect / Planner Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <input className="form-input" placeholder="Eng. A.B. Perera" {...register('prof_name', { required: true })} />
            </Field>
            <Field label="Designation">
              <input className="form-input" placeholder="Architect / Civil Engineer" {...register('prof_designation')} />
            </Field>
            <Field label="Phone">
              <input className="form-input" placeholder="0712345678" {...register('prof_phone')} />
            </Field>
            <Field label="Registration Number">
              <input className="form-input" placeholder="IESL/2024/0001" {...register('prof_reg')} />
            </Field>
          </div>
        </div>

        {/* Location on map */}
        <div className="p-4 border bg-slate-50 rounded-xl border-slate-200">
          <h3 className="mb-3 font-semibold text-slate-800">Booklet Pg02 — Site Location</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Place Description / Landmark">
              <input className="form-input" placeholder="Near Kelaniya Temple junction" {...register('place_description')} />
            </Field>
            <Field label="GPS Coordinates" hint="Optional — helps TO find the site">
              <div className="flex gap-2">
                <input className="form-input" placeholder="Latitude" {...register('map_lat')} />
                <input className="form-input" placeholder="Longitude" {...register('map_lng')} />
              </div>
            </Field>
          </div>
        </div>

        {/* Declaration */}
        <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl">
          <p className="text-sm text-amber-800">
            <strong>Declaration:</strong> I declare that all information provided is accurate and that no construction work
            will commence before the planning approval is granted. I understand that any false information may result
            in the rejection of this application.
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="secondary" onClick={onBack} type="button">← Back</Button>
          <Button variant="primary" type="submit" loading={loading} size="lg">
            Save & Continue →
          </Button>
        </div>
      </div>
    </form>
  )
}

// ── Step 4: Documents ─────────────────────────────────────────────────────────
const DocumentsStep: React.FC<{
  applicationId: string; required: string[]; files: File[];
  onChange: (f: File[]) => void; onBack: () => void; onNext: () => Promise<void>
}> = ({ applicationId, required, files, onChange, onBack, onNext }) => {
  const [uploading, setUploading] = useState(false)

  const handleNext = async () => {
    setUploading(true)
    await onNext()
    setUploading(false)
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-slate-900">Upload Documents</h2>
      <p className="mb-6 text-sm text-slate-500">Upload digital copies of all required documents</p>

      <div className="p-4 mb-4 border bg-slate-50 rounded-xl border-slate-200">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Required Documents</h3>
        <ul className="space-y-1">
          {required.map((doc: string, i: number) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-amber-500">○</span> {doc}
            </li>
          ))}
        </ul>
      </div>

      <FileUpload
        label="Upload Documents (PDF, JPG, PNG)"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        files={files}
        onChange={onChange}
      />

      <Alert type="info" className="mt-4">
        Please also bring 3 physical copies of your architectural/survey plans to the Pradeshiya Sabha office.
      </Alert>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={handleNext} loading={uploading} size="lg">
          Continue to Payment →
        </Button>
      </div>
    </div>
  )
}

// ── Step 5: Payment ───────────────────────────────────────────────────────────
const PaymentStep: React.FC<{
  referenceNumber: string; amount: number;
  onBack: () => void; onDone: () => void; toast: Function
}> = ({ referenceNumber, amount, onBack, onDone, toast }) => {
  const { user } = useAuth()
  const [method, setMethod]   = useState<'ONLINE' | 'BANK_SLIP'>('ONLINE')
  const [slip, setSlip]       = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  // Split full_name into first / last for PayHere billing fields
  const fullName: string = (user as any)?.full_name || ''
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] || 'Applicant'
  const lastName  = nameParts.slice(1).join(' ') || '-'

  const handlePayOnline = async () => {
    setLoading(true)
    try {
      const res = await paymentApi.initiatePayhere({
        reference_number: referenceNumber,
        amount:           amount,
        payment_type:     'APPLICATION_FEE',
        first_name:       firstName,
        last_name:        lastName,
        email:            (user as any)?.email || '',
        phone:            (user as any)?.phone || '0000000000',
        return_url: `${window.location.origin}/app/apply/done?ref=${referenceNumber}`,
        cancel_url:  `${window.location.origin}/app/apply`,
      })
      const data = res.data?.data ?? res.data

      // Demo / dev mode — PayHere not configured, simulate instead
      if (data.demo_mode) {
        toast('Demo mode: simulating payment...', 'info')
        await paymentApi.simulateCompletion(referenceNumber, 'APPLICATION_FEE')
        toast('Payment simulated successfully!', 'success')
        onDone()
        return
      }

      const { payment_url, params } = data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = payment_url
      Object.entries(params).forEach(([k, v]) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'
        inp.name = k
        inp.value = String(v)
        form.appendChild(inp)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const handleBankSlip = async () => {
    if (slip.length === 0) { toast('Please upload your bank slip', 'error'); return }
    setLoading(true)
    try {
      // Step 1: Create a PENDING online payment record (APPLICANT-accessible route)
      await paymentApi.online({
        reference_number: referenceNumber,
        amount,
        payment_type: 'APPLICATION_FEE',
        return_url: `${window.location.origin}/app/dashboard`,
      })

      // Step 2: Upload the slip as a BANK_SLIP document — auto-notifies PSO
      const fd = new FormData()
      fd.append('document', slip[0])
      fd.append('reference_number', referenceNumber)
      fd.append('category', 'BANK_SLIP')
      await documentApi.uploadByRef(fd)

      toast('Bank slip submitted. PSO will verify your payment within 1–2 working days.', 'success')
      onDone()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-slate-900">Application Fee Payment</h2>
      <p className="mb-6 text-sm text-slate-500">Pay the application fee to submit your application</p>

      <div className="p-4 mb-6 border bg-amber-50 border-amber-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-amber-900">Application Reference</div>
            <div className="font-mono text-lg text-amber-800">{referenceNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-amber-700">Amount Due</div>
            <div className="text-2xl font-bold text-amber-800">{fmtRs(amount)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        {(['ONLINE', 'BANK_SLIP'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cx('flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
              method === m ? 'border-ps-500 bg-ps-50 text-ps-700' : 'border-slate-200 text-slate-500'
            )}
          >
            {m === 'ONLINE' ? '💳 Online Payment (PayHere)' : '🏦 Bank Slip Upload'}
          </button>
        ))}
      </div>

      {method === 'ONLINE' && (
        <div className="space-y-4">
          <Alert type="info">
            You will be redirected to PayHere secure payment gateway. Return here after completing payment.
          </Alert>
          <Button variant="primary" onClick={handlePayOnline} loading={loading} size="lg" className="justify-center w-full">
            💳 Pay {fmtRs(amount)} via PayHere
          </Button>
        </div>
      )}

      {method === 'BANK_SLIP' && (
        <div className="space-y-4">
          <Alert type="info">
            Deposit the amount to the Kelaniya Pradeshiya Sabha account and upload the bank slip here.
            The PSO will verify your payment within 1-2 working days.
          </Alert>
          <FileUpload
            label="Upload Bank Deposit Slip"
            accept=".pdf,.jpg,.jpeg,.png"
            files={slip}
            onChange={setSlip}
          />
          <Button variant="primary" onClick={handleBankSlip} loading={loading} size="lg" className="justify-center w-full">
            Submit Bank Slip
          </Button>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <button onClick={onDone} className="text-sm text-slate-400 hover:text-slate-600">
          Skip for now →
        </button>
      </div>
    </div>
  )
}

// ── Step 6: Done ──────────────────────────────────────────────────────────────
const DoneStep: React.FC<{ referenceNumber: string; navigate: Function }> = ({ referenceNumber, navigate }) => (
  <div className="py-6 space-y-4 text-center">
    <div className="mb-4 text-6xl">🎉</div>
    <h2 className="text-2xl font-bold text-slate-900">Application Submitted!</h2>
    <p className="text-slate-500">Your planning application has been received by the Pradeshiya Sabha.</p>
    {referenceNumber && (
      <div className="inline-block p-4 border bg-ps-50 border-ps-200 rounded-xl">
        <div className="text-sm font-semibold text-ps-600">Your Reference Number</div>
        <div className="mt-1 font-mono text-2xl font-bold text-ps-800">{referenceNumber}</div>
        <div className="mt-1 text-xs text-ps-500">Keep this for tracking your application</div>
      </div>
    )}
    <div className="flex justify-center gap-3 mt-6">
      <Button variant="secondary" onClick={() => navigate('/app/applications')}>
        View My Applications
      </Button>
      <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
        Return to Dashboard
      </Button>
    </div>
  </div>
)

export default NewApplicationPage
