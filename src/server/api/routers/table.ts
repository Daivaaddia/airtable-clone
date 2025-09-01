import { z } from "zod";
import { faker } from '@faker-js/faker';
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const defaultColumns = ["Name", "Notes", "Number"]
const DEFAULTROWS = 10

const filterInput = z.object({
  columnName: z.string(),
  operator: z.enum([
    "is",
    "is_not",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty"
  ]),
  value: z.string(),
  combineWith: z.enum(["AND", "OR"]),
});

type FilterInput = z.infer<typeof filterInput>

function filterToSql(colAlias: string, filter: FilterInput) {
  switch (filter.operator) {
    case "is":
      return `${colAlias}.value = '${filter.value}'`;
    case "is_not":
      return `${colAlias}.value <> '${filter.value}'`;
    case "contains":
      return `${colAlias}.value ILIKE '%${filter.value}%'`;
    case "not_contains":
      return `NOT (${colAlias}.value ILIKE '%${filter.value}%')`;
    case "is_empty":
      return `${colAlias}.value IS NULL OR ${colAlias}.value = ''`;
    case "is_not_empty":
      return `${colAlias}.value IS NOT NULL AND ${colAlias}.value <> ''`;
    default:
      throw new Error("Unknown operator");
  }
}

export const tableRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.table.create({
            data: {
                name: input.name,
                sorting: "",
                base: { connect: { id: input.baseId } }
            }
        });
    }),

    createDefault: protectedProcedure
    .input(z.object({ id: z.string().optional(), baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            const table = await ctx.db.table.create({
                data: {
                    name: input.name,
                    sorting: "",
                    base: { connect: { id: input.baseId } }
                }
            });

            const columnData = defaultColumns.map((colName, index) => ({
                name: colName,
                order: index,
                tableId: table.id,
                type: colName === "Number" ? "NUMBER" : "TEXT"
            }));

            await tx.column.createMany({ data: columnData });

            const columns = await tx.column.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            const rowData = [];
            for (let i = 0; i < DEFAULTROWS; i++) {
                rowData.push({
                    order: i,
                    origOrder: i,
                    tableId: table.id
                })
            }; 

            await tx.row.createMany({ data: rowData });

            const rows = await tx.row.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            const cellData = rows.flatMap((row) =>
                columns.map((col) => {
                let value: string;

                if (col.type === "NUMBER") {
                    value = faker.number.int().toString();
                } else {
                    value = faker.person.fullName()
                }

                return {
                    rowId: row.id,
                    columnId: col.id,
                    columnName: col.name,
                    value,
                    type: col.type
                };
                })
            );

            await tx.cell.createMany({ data: cellData });
            return table;
        }, {
            maxWait: 5000,
            timeout: 20000,
        })
    }),

    getTable: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
        return ctx.db.table.findFirst({
            where: { id: input.id },
            include: {
                columns: {
                    orderBy: {order: "asc"}
                },
                rows: {
                    orderBy: {order: "asc"},
                    include: { cells: true },
                },
            },
        });
    }),

    sortTable: protectedProcedure
    .input(z.object({ 
        id: z.string(),
        columns: z.array(z.object({ columnName: z.string(), order: z.enum(["ASC", "DESC"])})).min(1)
    }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            const joins = input.columns
            .map((col, i) => `LEFT JOIN "Cell" c${i+1} ON c${i+1}."rowId" = r.id AND c${i+1}."columnName" = '${col.columnName}'`)
            .join("\n");
        
            const orderBy = input.columns
                .map((col, i) => `c${i+1}.value ${col.order}`)
                .join(", ");

            const sql = `
                WITH sorted AS (
                    SELECT r.id as rowId,
                    ROW_NUMBER() OVER (
                        ORDER BY ${orderBy}
                    ) AS new_order
                    FROM "Row" r
                    ${joins}
                    WHERE r."tableId" = '${input.id}'
                )
                UPDATE "Row" r
                SET "order" = sorted.new_order
                FROM sorted
                WHERE r.id = sorted.rowId
            `

            await ctx.db.$executeRawUnsafe(sql)

            await tx.table.updateMany({ 
                where: { id: input.id },
                data: { sorting: JSON.stringify(input.columns) }
            })
        })
        
    }),

    resetOrder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            await ctx.db.$executeRaw`
                UPDATE "Row"
                SET "order" = "origOrder"
                WHERE "tableId" = ${input.id}
            `

            await tx.table.update({
                where: { id: input.id },
                data: { sorting: "" }
            })
        })
    }),

    createRow: protectedProcedure
    .input(z.object({ 
        row: z.object({ id: z.string().optional(), order: z.number(), tableId: z.string() }),
        cells: z.array(z.object({ id: z.string().optional(), columnId: z.string(), type: z.string(), value: z.string(), rowId: z.string(), columnName: z.string() }))
    }))
    .mutation(async ({ ctx, input}) => {
        //const rowCount = await ctx.db.row.count({ where: { tableId: input.id } });
        const row = await ctx.db.row.create({
            data: {
                id: input.row.id,
                order: input.row.order,
                origOrder: input.row.order,
                tableId: input.row.tableId
            }
        })

        await ctx.db.cell.createMany({ data: input.cells })

        return row;
    }),

    createCol: protectedProcedure
    .input(z.object({ 
        col: z.object({ id: z.string().optional(), name: z.string(), type: z.string(), order: z.number(), tableId: z.string() }),
        cells: z.array(z.object({ id: z.string().optional(), columnId: z.string(), type: z.string(), value: z.string(), rowId: z.string(), columnName: z.string() }))
    }))
    .mutation(async ({ ctx, input}) => {
        const col = await ctx.db.column.create({
            data: {
                name: input.col.name,
                id: input.col.id,
                order: input.col.order,
                tableId: input.col.tableId,
                type: input.col.type
            }
        })

        await ctx.db.cell.createMany({ data: input.cells })

        return col;
    }),

    updateCell: protectedProcedure
    .input(z.object({ id: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.cell.updateMany({
            where: { id: input.id },
            data: { value: input.value }
        })
    }),

    getFilteredTable: protectedProcedure
    .input(z.object({
        id: z.string(),
        filters: z.array(filterInput),
    }))
    .query(async ({ ctx, input }) => {
        const joins = input.filters
        .map((f, i) => 
            `LEFT JOIN "Cell" f${i+1} ON f${i+1}."rowId" = r.id AND f${i+1}."columnName" = '${f.columnName}'`
        ).join("\n");

        const conditions = input.filters
        .map((f, i) => f.combineWith + ' ' + filterToSql(`f${i+1}`, f))
        .join(' ');

        const sql = `
            SELECT r.*
            FROM "Row" r
            ${joins}
            WHERE r."tableId" = '${input.id}'
            ${conditions}
        `

        return ctx.db.$queryRawUnsafe(sql)
    })
});