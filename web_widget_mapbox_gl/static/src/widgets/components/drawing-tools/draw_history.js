const DEFAULT_MAX_SIZE = 20;

/**
 * Manages undo/redo history for a Mapbox GL Draw instance.
 *
 * Owns the snapshot stack, the current position, and the restoring flag.
 * The host component calls push() after each draw event, undo()/redo() to
 * navigate, and beginRestore()/endRestore() to suppress re-snapshotting
 * while restoring.
 */
export class DrawHistory {
    constructor({ maxSize = DEFAULT_MAX_SIZE } = {}) {
        this.maxSize = maxSize;
        this._history = [];
        this._historyIndex = -1;
        this._isRestoring = false;
    }

    get canUndo() {
        return this._historyIndex > 0;
    }

    get canRedo() {
        return this._historyIndex < this._history.length - 1;
    }

    get isRestoring() {
        return this._isRestoring;
    }

    /**
     * Reset the stack with an optional initial snapshot.
     * Call this after loading fresh data into the draw control.
     * @param {Object} [initialSnapshot] GeoJSON FeatureCollection
     */
    reset(initialSnapshot) {
        this._history = [
            initialSnapshot ? JSON.parse(JSON.stringify(initialSnapshot)) : { type: 'FeatureCollection', features: [] },
        ];
        this._historyIndex = 0;
        this._isRestoring = false;
    }

    /**
     * Push a new snapshot onto the stack.
     * Truncates any redo history beyond the current position.
     * Returns false (and does nothing) while a restore is in progress.
     * @param {Object} snapshot GeoJSON FeatureCollection
     * @returns {boolean} Whether the snapshot was recorded
     */
    push(snapshot) {
        if (this._isRestoring) return false;
        this._history.splice(this._historyIndex + 1);
        this._history.push(JSON.parse(JSON.stringify(snapshot)));
        if (this._history.length > this.maxSize) {
            this._history.shift();
        }
        this._historyIndex = this._history.length - 1;
        return true;
    }

    /**
     * Move one step back and return the snapshot to restore.
     * Returns null if already at the beginning.
     * @returns {Object|null}
     */
    undo() {
        if (!this.canUndo) return null;
        this._historyIndex--;
        return this._history[this._historyIndex];
    }

    /**
     * Move one step forward and return the snapshot to restore.
     * Returns null if already at the latest entry.
     * @returns {Object|null}
     */
    redo() {
        if (!this.canRedo) return null;
        this._historyIndex++;
        return this._history[this._historyIndex];
    }

    beginRestore() {
        this._isRestoring = true;
    }

    endRestore() {
        this._isRestoring = false;
    }
}
