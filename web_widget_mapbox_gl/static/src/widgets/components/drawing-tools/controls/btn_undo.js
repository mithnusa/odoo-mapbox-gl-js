import { _t } from '@web/core/l10n/translation';

export class UndoButton {
    constructor(onClick) {
        this.el = this._createElement(onClick);
    }

    _createElement(onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_undo';
        btn.title = _t('Undo (Ctrl+Z)');
        btn.setAttribute('aria-label', _t('Undo'));
        btn.disabled = true;
        const icon = document.createElement('span');
        icon.className = 'fa fa-undo';
        icon.style.fontSize = '15px';
        btn.appendChild(icon);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    setEnabled(canUndo) {
        this.el.disabled = !canUndo;
        this.el.style.opacity = canUndo ? '' : '0.35';
    }
}
