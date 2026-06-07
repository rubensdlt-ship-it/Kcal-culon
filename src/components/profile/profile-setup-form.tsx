'use client'

import { useActionState } from 'react'
import { saveProfile, type ProfileState } from '@/app/profile/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const initialState: ProfileState = {}

type Props = {
  defaultFullName?: string
}

export function ProfileSetupForm({ defaultFullName = '' }: Props) {
  const [state, formAction, pending] = useActionState(
    saveProfile,
    initialState,
  )

  return (
    <form action={formAction} className="grid gap-6">
      {/* Sección 1: Datos personales */}
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Información básica sobre ti.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={defaultFullName}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gender">Sexo</Label>
            <Select name="gender" required>
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Hombre</SelectItem>
                <SelectItem value="female">Mujer</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="age">Edad</Label>
            <Input id="age" name="age" type="number" min={1} max={120} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="height_cm">Altura (cm)</Label>
            <Input
              id="height_cm"
              name="height_cm"
              type="number"
              min={50}
              max={260}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="current_weight_kg">Peso actual (kg)</Label>
            <Input
              id="current_weight_kg"
              name="current_weight_kg"
              type="number"
              step="0.1"
              min={20}
              max={400}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Sección 2: Estilo de vida */}
      <Card>
        <CardHeader>
          <CardTitle>Estilo de vida</CardTitle>
          <CardDescription>
            Tu actividad diaria y tu objetivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="job_type">Tipo de trabajo</Label>
            <Select name="job_type" required>
              <SelectTrigger id="job_type" className="w-full">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentario</SelectItem>
                <SelectItem value="light">Ligero</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="very_active">Muy activo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="activity_level">Nivel de actividad física</Label>
            <Select name="activity_level" required>
              <SelectTrigger id="activity_level" className="w-full">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Bajo</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="athlete">Atleta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="goal">Objetivo</Label>
            <Select name="goal" required>
              <SelectTrigger id="goal" className="w-full">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Perder peso</SelectItem>
                <SelectItem value="maintain">Mantener peso</SelectItem>
                <SelectItem value="gain">Ganar peso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sección 3: Salud */}
      <Card>
        <CardHeader>
          <CardTitle>Salud</CardTitle>
          <CardDescription>
            Opcional. Nos ayuda a personalizar tus consejos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="health_conditions">Condiciones de salud</Label>
            <Textarea
              id="health_conditions"
              name="health_conditions"
              placeholder="Por ejemplo: lesión de rodilla, alergias…"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pathologies">Patologías</Label>
            <Textarea
              id="pathologies"
              name="pathologies"
              placeholder="Por ejemplo: diabetes, hipertensión…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto sm:justify-self-end" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar y continuar'}
      </Button>
    </form>
  )
}
