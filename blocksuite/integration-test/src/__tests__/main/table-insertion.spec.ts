import type { TableBlockModel } from '@blocksuite/affine/model';
import { beforeEach, expect, test } from 'vitest';

import { TableDataManager } from '../../../../affine/blocks/table/src/table-data-manager.js';
import { setupEditor } from '../utils/setup.js';

type TableFixture = {
  dataManager: TableDataManager;
  model: TableBlockModel;
};

const getRootNoteId = () => {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }
  return doc.addBlock('affine:note', {}, rootId);
};

const getTableFixture = (): TableFixture => {
  const noteId = getRootNoteId();
  const tableId = doc.addBlock('affine:table', {}, noteId);
  const model = doc.getBlock(tableId)?.model as TableBlockModel | undefined;
  if (!model) {
    throw new Error('Cannot find table model');
  }

  const dataManager = new TableDataManager(model);
  dataManager.addColumn();
  dataManager.addColumn(0);
  dataManager.addRow();
  dataManager.addRow(0);

  const rows = dataManager.rows$.value;
  const columns = dataManager.columns$.value;
  if (rows.length !== 2 || columns.length !== 2) {
    throw new Error('Failed to initialize 2x2 table');
  }

  setCellText(model, rows[0].rowId, columns[0].columnId, 'Cell1');
  setCellText(model, rows[0].rowId, columns[1].columnId, 'Cell2');
  setCellText(model, rows[1].rowId, columns[0].columnId, 'Cell3');
  setCellText(model, rows[1].rowId, columns[1].columnId, 'Cell4');

  return { dataManager, model };
};

const getCellText = (
  model: TableBlockModel,
  rowId: string,
  columnId: string
): string => {
  return model.props.cells[`${rowId}:${columnId}`]?.text.toString() ?? '';
};

const setCellText = (
  model: TableBlockModel,
  rowId: string,
  columnId: string,
  value: string
) => {
  const cell = model.props.cells[`${rowId}:${columnId}`];
  if (!cell) {
    throw new Error(`Cannot find table cell: ${rowId}:${columnId}`);
  }
  cell.text.replace(0, cell.text.length, value);
};

const getRowTexts = (
  dataManager: TableDataManager,
  model: TableBlockModel,
  rowIndex: number
) => {
  const row = dataManager.rows$.value[rowIndex];
  if (!row) {
    throw new Error(`Cannot find row at index ${rowIndex}`);
  }
  return dataManager.columns$.value.map(column =>
    getCellText(model, row.rowId, column.columnId)
  );
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

test('insert left and right should keep expected column order', () => {
  const { dataManager, model } = getTableFixture();

  dataManager.insertColumn(0);
  expect(dataManager.columns$.value).toHaveLength(3);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[1].columnId,
    'New Right'
  );
  expect(getRowTexts(dataManager, model, 0)).toEqual([
    'Cell1',
    'New Right',
    'Cell2',
  ]);

  dataManager.insertColumn();
  expect(dataManager.columns$.value).toHaveLength(4);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[0].columnId,
    'New Left'
  );
  expect(getRowTexts(dataManager, model, 0)).toEqual([
    'New Left',
    'Cell1',
    'New Right',
    'Cell2',
  ]);
});

test('insert above and below should keep expected row order', () => {
  const { dataManager, model } = getTableFixture();

  dataManager.insertRow(0);
  expect(dataManager.rows$.value).toHaveLength(3);
  setCellText(
    model,
    dataManager.rows$.value[1].rowId,
    dataManager.columns$.value[0].columnId,
    'New Below 1'
  );
  setCellText(
    model,
    dataManager.rows$.value[1].rowId,
    dataManager.columns$.value[1].columnId,
    'New Below 2'
  );
  expect(getRowTexts(dataManager, model, 0)).toEqual(['Cell1', 'Cell2']);
  expect(getRowTexts(dataManager, model, 1)).toEqual([
    'New Below 1',
    'New Below 2',
  ]);
  expect(getRowTexts(dataManager, model, 2)).toEqual(['Cell3', 'Cell4']);

  dataManager.insertRow();
  expect(dataManager.rows$.value).toHaveLength(4);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[0].columnId,
    'New Above 1'
  );
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[1].columnId,
    'New Above 2'
  );
  expect(getRowTexts(dataManager, model, 0)).toEqual([
    'New Above 1',
    'New Above 2',
  ]);
  expect(getRowTexts(dataManager, model, 1)).toEqual(['Cell1', 'Cell2']);
});

test('insert at table edges should place rows and columns at boundaries', () => {
  const { dataManager, model } = getTableFixture();

  dataManager.insertColumn();
  expect(dataManager.columns$.value).toHaveLength(3);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[0].columnId,
    'Left Edge'
  );
  expect(getRowTexts(dataManager, model, 0).slice(0, 3)).toEqual([
    'Left Edge',
    'Cell1',
    'Cell2',
  ]);

  dataManager.insertRow();
  expect(dataManager.rows$.value).toHaveLength(3);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[0].columnId,
    'Above Edge'
  );
  expect(
    getCellText(
      model,
      dataManager.rows$.value[1].rowId,
      dataManager.columns$.value[0].columnId
    )
  ).toBe('Left Edge');

  const lastColumnIndex = dataManager.columns$.value.length - 1;
  dataManager.insertColumn(lastColumnIndex);
  expect(dataManager.columns$.value).toHaveLength(4);
  setCellText(
    model,
    dataManager.rows$.value[0].rowId,
    dataManager.columns$.value[3].columnId,
    'Right Edge'
  );
  expect(getRowTexts(dataManager, model, 0)[3]).toBe('Right Edge');

  const lastRowIndex = dataManager.rows$.value.length - 1;
  dataManager.insertRow(lastRowIndex);
  expect(dataManager.rows$.value).toHaveLength(4);
  setCellText(
    model,
    dataManager.rows$.value[3].rowId,
    dataManager.columns$.value[0].columnId,
    'Below Edge'
  );
  expect(
    getCellText(
      model,
      dataManager.rows$.value[3].rowId,
      dataManager.columns$.value[0].columnId
    )
  ).toBe('Below Edge');
});
