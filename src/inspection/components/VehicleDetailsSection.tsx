import { FieldErrors, UseFormRegister } from 'react-hook-form';
import { DatasheetFormData } from '@/types/datasheet';
import { FUEL_TYPES, VEHICLE_USAGE_OPTIONS } from '../types/inspection';
import { inspectionPath } from '../utils/formPaths';
import { FormField } from './FormField';
import { FieldGroup } from './FieldGroup';

interface VehicleDetailsSectionProps {
  register: UseFormRegister<DatasheetFormData>;
  errors: FieldErrors<DatasheetFormData>;
}

export function VehicleDetailsSection({ register, errors }: VehicleDetailsSectionProps) {
  const vd = errors.inspection?.vehicleDetails;

  return (
    <div className="space-y-5">
      <FieldGroup title="Inspection Information" description="When and where the inspection takes place">
        <FormField label="Inspection Date" required error={vd?.inspectionDate?.message}>
          <input type="date" {...register(inspectionPath('vehicleDetails.inspectionDate'))} className="form-input" />
        </FormField>
        <FormField label="Inspection Time" required error={vd?.inspectionTime?.message}>
          <input type="time" {...register(inspectionPath('vehicleDetails.inspectionTime'))} className="form-input" />
        </FormField>
        <FormField label="Inspector Name" required error={vd?.inspectorName?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.inspectorName'))} className="form-input" placeholder="Full name" />
        </FormField>
        <FormField label="Physical Inspection Location" required error={vd?.inspectionLocation?.message} className="sm:col-span-2">
          <input type="text" {...register(inspectionPath('vehicleDetails.inspectionLocation'))} className="form-input" placeholder="Address or location name" />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Vehicle Identity" description="Registration and technical specifications">
        <FormField label="Registration Number" required error={vd?.registrationNumber?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.registrationNumber'))} className="form-input" placeholder="e.g. KAA 123A" />
        </FormField>
        <FormField label="Make" required error={vd?.make?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.make'))} className="form-input" placeholder="e.g. Toyota" />
        </FormField>
        <FormField label="Model" required error={vd?.model?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.model'))} className="form-input" placeholder="e.g. Corolla" />
        </FormField>
        <FormField label="Year of Manufacture" required error={vd?.yearOfManufacture?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.yearOfManufacture'))} className="form-input" placeholder="e.g. 2020" maxLength={4} />
        </FormField>
        <FormField label="Engine Number" required error={vd?.engineNumber?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.engineNumber'))} className="form-input" />
        </FormField>
        <FormField label="Engine CC" error={vd?.engineCC?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.engineCC'))} className="form-input" placeholder="e.g. 1800" />
        </FormField>
        <FormField label="Chassis / VIN Number" required error={vd?.chassisVin?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.chassisVin'))} className="form-input" />
        </FormField>
        <FormField label="Fuel Type" required error={vd?.fuelType?.message}>
          <select {...register(inspectionPath('vehicleDetails.fuelType'))} className="form-input" defaultValue="">
            <option value="">Select fuel type</option>
            {FUEL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Vehicle Color" required error={vd?.vehicleColor?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.vehicleColor'))} className="form-input" />
        </FormField>
        <FormField label="Odometer Reading (KM)" required error={vd?.odometerReading?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.odometerReading'))} className="form-input" placeholder="e.g. 85000" />
        </FormField>
        <FormField label="Seating Capacity" required error={vd?.seatingCapacity?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.seatingCapacity'))} className="form-input" placeholder="e.g. 5" />
        </FormField>
        <FormField label="Vehicle Usage" required error={vd?.vehicleUsage?.message}>
          <select {...register(inspectionPath('vehicleDetails.vehicleUsage'))} className="form-input" defaultValue="">
            <option value="">Select usage type</option>
            {VEHICLE_USAGE_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </FormField>
      </FieldGroup>

      <FieldGroup title="Owner & Insurance" description="Vehicle owner and policy details">
        <FormField label="Owner Name" required error={vd?.ownerName?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.ownerName'))} className="form-input" />
        </FormField>
        <FormField label="Owner Contact" required error={vd?.ownerContact?.message}>
          <input type="tel" {...register(inspectionPath('vehicleDetails.ownerContact'))} className="form-input" placeholder="Phone or email" />
        </FormField>
        <FormField label="Insurance Company" error={vd?.insuranceCompany?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.insuranceCompany'))} className="form-input" />
        </FormField>
        <FormField label="Policy Number" error={vd?.policyNumber?.message}>
          <input type="text" {...register(inspectionPath('vehicleDetails.policyNumber'))} className="form-input" />
        </FormField>
      </FieldGroup>
    </div>
  );
}
