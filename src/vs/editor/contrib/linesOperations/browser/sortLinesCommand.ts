/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { safeIntl } from '../../../../base/common/date.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { EditOperation, ISingleEditOperation } from '../../../common/core/editOperation.js';
import { Range } from '../../../common/core/range.js';
import { Selection } from '../../../common/core/selection.js';
import { ICommand, ICursorStateComputerData, IEditOperationBuilder } from '../../../common/editorCommon.js';
import { ITextModel } from '../../../common/model.js';

export class SortLinesCommand implements ICommand {

	static _COLLATOR: Lazy<Intl.Collator> = safeIntl.Collator();

	private readonly range: Range;
	private readonly selection: Selection;
	private readonly descending: boolean;
	private selectionId: string | null;

	constructor(range: Range, selection: Selection, descending: boolean) {
		this.range = range;
		this.selection = selection;
		this.descending = descending;
		this.selectionId = null;
	}

	public getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void {
		const op = sortLines(model, this.range, this.descending);
		if (op) {
			builder.addEditOperation(op.range, op.text);
		}

		this.selectionId = builder.trackSelection(this.selection);
	}

	public computeCursorState(model: ITextModel, helper: ICursorStateComputerData): Selection {
		return helper.getTrackedSelection(this.selectionId!);
	}

	public static canRun(model: ITextModel | null, range: Range, descending: boolean): boolean {
		if (model === null) {
			return false;
		}

		const data = getSortData(model, range, descending);

		if (!data) {
			return false;
		}

		for (let i = 0, len = data.before.length; i < len; i++) {
			if (data.before[i] !== data.after[i]) {
				return true;
			}
		}

		return false;
	}
}

function getSortData(model: ITextModel, range: Range, descending: boolean) {
	const startLineNumber = range.startLineNumber;
	let endLineNumber = range.endLineNumber;

	if (range.endColumn === 1) {
		endLineNumber--;
	}

	// Nothing to sort if user didn't select anything.
	if (startLineNumber >= endLineNumber) {
		return null;
	}

	const linesToSort: string[] = [];

	// Get the contents of the selection to be sorted.
	for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
		linesToSort.push(model.getLineContent(lineNumber));
	}

	let sorted = linesToSort.slice(0);
	sorted.sort(SortLinesCommand._COLLATOR.value.compare);

	// If descending, reverse the order.
	if (descending === true) {
		sorted = sorted.reverse();
	}

	return {
		startLineNumber: startLineNumber,
		endLineNumber: endLineNumber,
		before: linesToSort,
		after: sorted
	};
}

/**
 * Generate commands for sorting lines on a model.
 */
function sortLines(model: ITextModel, range: Range, descending: boolean): ISingleEditOperation | null {
	const data = getSortData(model, range, descending);

	if (!data) {
		return null;
	}

	return EditOperation.replace(
		new Range(data.startLineNumber, 1, data.endLineNumber, model.getLineMaxColumn(data.endLineNumber)),
		data.after.join('\n')
	);
}
