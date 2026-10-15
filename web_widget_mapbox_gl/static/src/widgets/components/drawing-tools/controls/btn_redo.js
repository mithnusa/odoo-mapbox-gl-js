import { _t } from '@web/core/l10n/translation';

export class RedoButton {
    constructor(onClick) {
        this.el = this._createElement(onClick);
    }

    _createElement(onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_redo';
        btn.title = _t('Redo (Ctrl+Y)');
        btn.setAttribute('aria-label', _t('Redo'));
        btn.disabled = true;
        const icon = document.createElement('span');
        icon.className = 'fa fa-repeat';
        icon.style.fontSize = '15px';
        btn.appendChild(icon);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    setEnabled(canRedo) {
        this.el.disabled = !canRedo;
        this.el.style.opacity = canRedo ? '' : '0.35';
    }
}
