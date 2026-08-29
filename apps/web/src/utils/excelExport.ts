/**
 * excelExport.ts — 生成 Excel 装箱清单工作簿
 *
 * 消费 ExportManifest（经契约校验的导出清单）生成 .xlsx 文件：
 *   - Sheet「装箱总览」: 各集装箱汇总 + 总计行
 *   - Sheet「清单-{箱名}」: 逐件货物明细 + 扎带用量
 *   - Sheet「未装柜货物」(可选): 放置失败的原因报告
 *
 * 使用浏览器端 SheetJS (xlsx) 生成并触发下载，无后端参与。
 */

import * as XLSX from "xlsx";
import type { ExportManifest, SolveRequest, SolveResult } from "@sunmao/contracts";

/** 项目名称（作为下载文件名的一部分） */
const EXPORT_PROJECT_NAME = "榫卯视界";

/** Excel sheet 名不允许的字符与 31 字符上限 */
function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, "-").trim();
  const suffix = `#${index + 1}`;
  const maxNameLength = 31 - suffix.length;
  return `${cleaned.slice(0, maxNameLength)}${suffix}`;
}

/** 生成总览 sheet 的二维表 */
function buildOverviewRows(manifest: ExportManifest): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["集装箱", "规格(mm)", "件数", "净重(kg)", "扎带重(kg)", "毛重(kg)", "利用率(%)"],
  ];

  for (const container of manifest.containers) {
    rows.push([
      container.containerName,
      container.containerSpec,
      container.summary.itemCount,
      container.summary.netWeight,
      container.summary.lashingWeight,
      container.summary.grossWeight,
      container.summary.utilization,
    ]);
  }

  rows.push([
    "总计",
    `${manifest.grandTotal.totalContainers} 箱`,
    manifest.grandTotal.totalItems,
    manifest.grandTotal.totalNetWeight,
    "",
    manifest.grandTotal.totalGrossWeight,
    "",
  ]);

  return rows;
}

/** 生成单个集装箱明细 sheet 的二维表 */
function buildContainerRows(container: ExportManifest["containers"][number]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [`集装箱: ${container.containerName}（规格 ${container.containerSpec} mm）`],
    [],
    ["货物ID", "名称", "数量", "单重(kg)", "总重(kg)", "尺寸(mm)", "放置坐标(mm)"],
  ];

  for (const item of container.items) {
    rows.push([
      item.id,
      item.name,
      item.quantity,
      item.unitWeight,
      item.totalWeight,
      item.dimensions,
      item.position,
    ]);
  }

  if (container.lashingUsed.length > 0) {
    rows.push([]);
    rows.push(["扎带用量"]);
    rows.push(["类型", "规格", "数量"]);
    for (const lashing of container.lashingUsed) {
      rows.push([lashing.type, lashing.specification, lashing.quantityOrLength]);
    }
  }

  return rows;
}

/** 生成未装柜货物 sheet 的二维表 */
function buildUnplacedRows(
  unplacedItems: SolveResult["unplacedItems"],
  cargoList: ReadonlyArray<{ displayName: string }>,
): (string | number)[][] {
  const rows: (string | number)[][] = [["货物", "未装柜原因"]];

  for (const unplaced of unplacedItems) {
    const cargo = cargoList[unplaced.cargoIndex];
    rows.push([cargo?.displayName ?? `货物#${unplaced.cargoIndex}`, unplaced.reason]);
  }

  return rows;
}

/**
 * 从 ExportManifest + 求解结果生成 .xlsx 并触发浏览器下载。
 *
 * @param manifest    - 经契约校验的导出清单
 * @param project     - 求解请求（用于未装柜货物的名称显示，可缺省）
 * @param solveResult - 求解结果（用于未装柜货物报告，可缺省）
 */
export function exportManifestToExcel(
  manifest: ExportManifest,
  project?: SolveRequest,
  solveResult?: SolveResult,
): void {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildOverviewRows(manifest)),
    "装箱总览",
  );

  manifest.containers.forEach((container, index) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(buildContainerRows(container)),
      sanitizeSheetName(container.containerName, index),
    );
  });

  if (project && solveResult && solveResult.unplacedItems.length > 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(
        buildUnplacedRows(solveResult.unplacedItems, project.cargoList),
      ),
      "未装柜货物",
    );
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${EXPORT_PROJECT_NAME}-装箱清单-${dateStamp}.xlsx`);
}
