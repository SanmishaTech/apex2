// Generic pagination utility: parallel count + list fetch with defensive caps (perPage <= 100).
// Accepts a Prisma-like model object (count/findMany) to remain decoupled from concrete types.

export type PaginateParams<TSelect extends object | undefined, TWhere extends object | undefined> = {
  model: { count: (args: { where?: TWhere }) => Promise<number>; findMany: (args: any) => Promise<unknown[]> };
  where?: TWhere;
  orderBy?: Record<string, 'asc' | 'desc'>;
  page?: number;
  perPage?: number;
  select?: TSelect;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export async function paginate<TSelect extends object | undefined, TWhere extends object | undefined, T = unknown>(
  params: PaginateParams<TSelect, TWhere>
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(100, Math.max(1, params.perPage || 10));
  const [total, rows] = await Promise.all([
    params.model.count({ where: params.where }),
    params.model.findMany({
      where: params.where,
      orderBy: params.orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: params.select,
    }),
  ]);
  return {
    data: rows as T[],
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}
