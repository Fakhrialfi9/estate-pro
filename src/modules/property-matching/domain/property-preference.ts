import type {
  BudgetPreference,
  HardCriterion,
  LocationPreference,
  PriceFrequency,
  PropertyPreferenceState,
  SpecificationPreference,
} from './matching.types.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^\d+(?:\.\d{1,2})?$/;

const assertUuidList = (values: readonly string[], field: string): void => {
  for (const value of values)
    if (!UUID_V4.test(value))
      throw new Error(`${field} contains an invalid UUID`);
};
const decimal = (
  value: string | undefined,
  field: string,
): number | undefined => {
  if (value == null) return undefined;
  if (!MONEY.test(value))
    throw new Error(`${field} must be a non-negative decimal`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be finite`);
  return parsed;
};
const assertRange = (
  min: string | undefined,
  max: string | undefined,
  field: string,
): void => {
  const minValue = decimal(min, `${field}.min`);
  const maxValue = decimal(max, `${field}.max`);
  if (minValue != null && maxValue != null && minValue > maxValue)
    throw new Error(`${field}.min must not exceed ${field}.max`);
};

export class PropertyPreference {
  private constructor(private readonly state: PropertyPreferenceState) {}

  static create(
    input: Omit<PropertyPreferenceState, 'version'> & { version?: number },
  ): PropertyPreference {
    const version = input.version ?? 1;
    if (!Number.isInteger(version) || version < 1)
      throw new Error('version must be a positive integer');
    if (
      input.transactionTypes.length === 0 &&
      input.propertyTypeUuids.length === 0 &&
      input.propertyCategoryUuids.length === 0 &&
      !input.location &&
      !input.budget &&
      !input.specification
    )
      throw new Error('At least one matching preference is required');
    assertUuidList(input.propertyTypeUuids, 'propertyTypeUuids');
    assertUuidList(input.propertyCategoryUuids, 'propertyCategoryUuids');
    const hardCriteria = [...new Set(input.hardCriteria)] as HardCriterion[];
    if (
      hardCriteria.some(
        (criterion) =>
          ![
            'transactionType',
            'propertyType',
            'propertyCategory',
            'location',
            'budget',
          ].includes(criterion),
      )
    )
      throw new Error('Unknown hard criterion');
    if (
      hardCriteria.includes('transactionType') &&
      input.transactionTypes.length === 0
    )
      throw new Error(
        'transactionType hard criterion requires a transaction type',
      );
    if (
      hardCriteria.includes('propertyType') &&
      input.propertyTypeUuids.length === 0
    )
      throw new Error('propertyType hard criterion requires a property type');
    if (
      hardCriteria.includes('propertyCategory') &&
      input.propertyCategoryUuids.length === 0
    )
      throw new Error('propertyCategory hard criterion requires a category');
    if (hardCriteria.includes('location') && !input.location)
      throw new Error('location hard criterion requires a location');
    if (hardCriteria.includes('budget') && !input.budget)
      throw new Error('budget hard criterion requires a budget');
    PropertyPreference.assertLocation(input.location);
    PropertyPreference.assertBudget(input.budget);
    PropertyPreference.assertSpecification(input.specification);
    return new PropertyPreference({ ...input, version, hardCriteria });
  }

  get value(): PropertyPreferenceState {
    return {
      ...this.state,
      transactionTypes: [...this.state.transactionTypes],
      propertyTypeUuids: [...this.state.propertyTypeUuids],
      propertyCategoryUuids: [...this.state.propertyCategoryUuids],
      hardCriteria: [...this.state.hardCriteria],
      location: this.state.location ? { ...this.state.location } : undefined,
      budget: this.state.budget ? { ...this.state.budget } : undefined,
      specification: this.state.specification
        ? structuredClone(this.state.specification)
        : undefined,
    };
  }
  withVersion(version: number): PropertyPreference {
    if (!Number.isInteger(version) || version <= this.state.version)
      throw new Error('version must increase');
    return new PropertyPreference({ ...this.state, version });
  }

  static assertBudget(budget: BudgetPreference | undefined): void {
    if (!budget) return;
    if (!/^[A-Z]{3}$/.test(budget.currency))
      throw new Error('currency must be a 3-letter ISO-style code');
    const validFrequency: readonly PriceFrequency[] = [
      'TOTAL',
      'PER_MONTH',
      'PER_YEAR',
      'PER_DAY',
    ];
    if (!validFrequency.includes(budget.frequency))
      throw new Error('Unsupported price frequency');
    assertRange(budget.min, budget.max, 'budget');
    if (
      budget.tolerancePercent != null &&
      (!Number.isFinite(budget.tolerancePercent) ||
        budget.tolerancePercent < 0 ||
        budget.tolerancePercent > 100)
    )
      throw new Error('budget.tolerancePercent must be between 0 and 100');
  }

  static assertLocation(location: LocationPreference | undefined): void {
    if (!location) return;
    for (const [field, value] of Object.entries(location))
      if (
        field.endsWith('Uuid') &&
        value != null &&
        !UUID_V4.test(String(value))
      )
        throw new Error(`${field} must be a UUID`);
    if ((location.latitude == null) !== (location.longitude == null))
      throw new Error('latitude and longitude must be supplied together');
    if (
      location.radiusKm != null &&
      (!Number.isFinite(location.radiusKm) ||
        location.radiusKm <= 0 ||
        location.radiusKm > 500)
    )
      throw new Error('radiusKm must be > 0 and <= 500');
    if (
      location.radiusKm != null &&
      (location.latitude == null || location.longitude == null)
    )
      throw new Error('radiusKm requires latitude and longitude');
    if (
      location.latitude != null &&
      (location.latitude < -90 || location.latitude > 90)
    )
      throw new Error('latitude out of range');
    if (
      location.longitude != null &&
      (location.longitude < -180 || location.longitude > 180)
    )
      throw new Error('longitude out of range');
  }

  static assertSpecification(
    specification: SpecificationPreference | undefined,
  ): void {
    if (!specification) return;
    if (specification.bedrooms)
      PropertyPreference.assertIntRange(
        specification.bedrooms.min,
        specification.bedrooms.max,
        'bedrooms',
      );
    if (specification.bathrooms)
      assertRange(
        specification.bathrooms.min,
        specification.bathrooms.max,
        'bathrooms',
      );
    if (specification.areaSqm)
      assertRange(
        specification.areaSqm.min,
        specification.areaSqm.max,
        'areaSqm',
      );
    if (specification.parkingSpaces)
      PropertyPreference.assertIntRange(
        specification.parkingSpaces.min,
        specification.parkingSpaces.max,
        'parkingSpaces',
      );
  }

  private static assertIntRange(
    min: number | undefined,
    max: number | undefined,
    field: string,
  ): void {
    if (min != null && (!Number.isInteger(min) || min < 0 || min > 100))
      throw new Error(`${field}.min is invalid`);
    if (max != null && (!Number.isInteger(max) || max < 0 || max > 100))
      throw new Error(`${field}.max is invalid`);
    if (min != null && max != null && min > max)
      throw new Error(`${field}.min must not exceed ${field}.max`);
  }
}
