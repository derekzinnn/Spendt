import type { CategoryDto, CategoryKind } from '@spendly/shared'

/**
 * `<option>`s for a native category select: active categories of one kind, grouped by parent
 * ("Mercado", "Mercado › Feira"). A `keepId` (the row's current category) stays listed even if
 * archived, so editing old rows never loses their value.
 */
export function CategoryOptions({
  categories,
  kind,
  keepId,
}: {
  categories: CategoryDto[]
  kind: CategoryKind
  keepId?: string | null
}) {
  const usable = categories.filter((c) => c.kind === kind && (!c.archivedAt || c.id === keepId))
  const parents = usable.filter((c) => !c.parentId)
  return (
    <>
      {parents.map((parent) => (
        <optgroup key={parent.id} label={parent.name}>
          <option value={parent.id}>{parent.name}</option>
          {usable
            .filter((c) => c.parentId === parent.id)
            .map((child) => (
              <option key={child.id} value={child.id}>
                {parent.name} › {child.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  )
}
