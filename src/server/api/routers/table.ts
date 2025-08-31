import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const defaultColumns = ["Name", "Notes", "Assignee", "Status", "Attachments", "Attachment Summary"]
const DEFAULTROWS = 3
let columnIds: string[] = []
let rowIds: string[] = []

export const tableRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.table.create({
            data: {
                name: input.name,
                base: { connect: { id: input.baseId } }
            }
        });
    }),

    createDefault: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return await  ctx.db.$transaction(async (tx) => {
            const table = await ctx.db.table.create({
                data: {
                    name: input.name,
                    base: { connect: { id: input.baseId } }
                }
            });

            const columnData = defaultColumns.map((colName, index) => ({
                name: colName,
                order: index,
                tableId: table.id,
            }));

            await tx.column.createMany({ data: columnData });

            const columns = await tx.column.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            let rowData = [];
            for (let i = 0; i < DEFAULTROWS; i++) {
                rowData.push({
                    order: i,
                    tableId: table.id
                })
            }; 

            await tx.row.createMany({ data: rowData });

            const rows = await tx.row.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            const cellData = rows.flatMap((row) =>
                columns.map((col) => ({
                    rowId: row.id,
                    columnId: col.id,
                    value: "",
                }))
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

    updateCell: protectedProcedure
    .input(z.object({ id: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.cell.update({
            where: { id: input.id },
            data: { value: input.value }
        })
    })  
});