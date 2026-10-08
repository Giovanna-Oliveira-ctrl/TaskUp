/* =========================================================
   TaskUp — categories.js
   Criar, editar, excluir e visualizar categorias.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Tasks, Game } = window.TU;
  const Actions = window.TU.Actions;

  const Categories = {
    openForm(id = null) {
      const editing = id ? Store.state.categories.find((c) => c.id === id) : null;
      const c = editing || { name: '', emoji: '📌', color: U.pick(U.COLORS) };
      UI.modal({
        title: editing ? 'Editar categoria' : 'Nova categoria',
        size: 'sm',
        body: `
          <form class="form" autocomplete="off">
            <div class="field-row title-row">
              ${UI.emojiPicker(c.emoji)}
              <input class="input input-lg" name="name" placeholder="Nome da categoria" value="${U.escape(c.name)}" required maxlength="40" autofocus>
            </div>
            <div class="field">
              <label>Cor</label>
              ${UI.colorPicker(c.color)}
            </div>
            <div class="cat-preview"></div>
            <div class="form-actions">
              <span></span>
              <div class="row gap">
                <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
                <button type="submit" class="btn btn-primary">${editing ? 'Salvar' : 'Criar'}</button>
              </div>
            </div>
          </form>`,
        onMount(el, api) {
          UI.bindEmojiPicker(el);
          const form = el.querySelector('form');
          const preview = el.querySelector('.cat-preview');
          const custom = form.querySelector('[name="color-custom"]');
          const color = () => form.querySelector('[name="color"]:checked')?.value || custom.value;
          const upd = () => {
            preview.innerHTML = `<span class="chip lg" style="--c:${color()}">${form.emoji.value || '📌'} ${U.escape(form.name.value || 'Prévia')}</span>`;
          };
          custom.addEventListener('input', () => {
            form.querySelectorAll('[name="color"]').forEach((r) => (r.checked = false));
            upd();
          });
          form.addEventListener('input', upd);
          el.querySelector('.emoji-grid').addEventListener('click', () => setTimeout(upd));
          upd();
          el.querySelector('[data-cancel]').onclick = () => api.close();
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = form.name.value.trim();
            if (!name) return;
            const data = { name, emoji: form.emoji.value || '📌', color: color() };
            if (editing) {
              Store.update((s) => Object.assign(s.categories.find((x) => x.id === editing.id), data));
              UI.toast('Categoria atualizada', { type: 'success' });
            } else {
              Store.update((s) => s.categories.push({ id: 'c-' + U.uid(), ...data }));
              UI.toast(`Categoria ${data.emoji} ${data.name} criada!`, { type: 'success' });
              Game.checkAchievements();
            }
            api.close();
          });
        },
      });
    },

    async remove(id) {
      const s = Store.state;
      const cat = s.categories.find((c) => c.id === id);
      if (!cat) return;
      if (id === 'cat-outros') {
        UI.toast('A categoria "Outros" é usada como padrão e não pode ser excluída.', { type: 'error' });
        return;
      }
      const count = s.tasks.filter((t) => t.categoryId === id).length;
      if (!count) {
        const ok = await UI.confirm({ title: `Excluir "${cat.name}"?`, okText: 'Excluir', danger: true, icon: cat.emoji });
        if (ok) Store.update((st) => (st.categories = st.categories.filter((c) => c.id !== id)));
        return;
      }
      UI.modal({
        size: 'sm',
        className: 'modal-confirm',
        body: `
          <div class="confirm-icon">${cat.emoji}</div>
          <h3>Excluir "${U.escape(cat.name)}"?</h3>
          <p class="muted">Ela possui ${count} tarefa${count > 1 ? 's' : ''}. O que fazer com elas?</p>
          <div class="field">
            <select class="input" data-move>
              ${s.categories.filter((c) => c.id !== id).map((c) => `<option value="${c.id}" ${c.id === 'cat-outros' ? 'selected' : ''}>Mover para ${c.emoji} ${U.escape(c.name)}</option>`).join('')}
              <option value="__delete">🗑️ Excluir as tarefas também</option>
            </select>
          </div>
          <div class="confirm-actions">
            <button class="btn btn-ghost" data-cancel>Cancelar</button>
            <button class="btn btn-danger" data-ok>Excluir categoria</button>
          </div>`,
        onMount(el, api) {
          el.querySelector('[data-cancel]').onclick = () => api.close();
          el.querySelector('[data-ok]').onclick = () => {
            const target = el.querySelector('[data-move]').value;
            Store.update((st) => {
              if (target === '__delete') st.tasks = st.tasks.filter((t) => t.categoryId !== id);
              else st.tasks.forEach((t) => t.categoryId === id && (t.categoryId = target));
              st.categories = st.categories.filter((c) => c.id !== id);
            });
            api.close();
            UI.toast('Categoria excluída', { icon: '🗑️' });
          };
        },
      });
    },

    move(id, dir) {
      Store.update((s) => {
        const i = s.categories.findIndex((c) => c.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.categories.length) return;
        [s.categories[i], s.categories[j]] = [s.categories[j], s.categories[i]];
      });
    },

    render(view) {
      const s = Store.state;
      const today = U.today();
      view.innerHTML = `
        <div class="row between mb">
          <p class="muted">Organize suas atividades por áreas da vida. Clique em uma categoria para ver suas tarefas.</p>
          <button class="btn btn-primary" data-action="new-category">＋ Nova categoria</button>
        </div>
        <div class="cat-cards">
          ${s.categories
            .map((c, i) => {
              const list = s.tasks.filter((t) => t.categoryId === c.id);
              const done = list.filter((t) => t.done).length;
              const pending = list.length - done;
              const overdue = list.filter((t) => Tasks.isOverdue(t)).length;
              const todayN = list.filter((t) => t.date === today && !t.done).length;
              const pct = list.length ? Math.round((done / list.length) * 100) : 0;
              return `
              <div class="card cat-card" style="--c:${c.color}">
                <div class="cat-card-top" data-action="open-category" data-id="${c.id}" role="button" tabindex="0">
                  <span class="cat-emoji">${c.emoji}</span>
                  <div>
                    <h3>${U.escape(c.name)}</h3>
                    <span class="muted small">${pending} pendente${pending === 1 ? '' : 's'}${todayN ? ` · ${todayN} hoje` : ''}${overdue ? ` · <span class="danger">${overdue} atrasada${overdue === 1 ? '' : 's'}</span>` : ''}</span>
                  </div>
                </div>
                <div class="progress sm cat-progress"><span style="width:${pct}%"></span></div>
                <div class="row between">
                  <span class="muted small">${done}/${list.length} concluídas</span>
                  <div class="cat-actions">
                    <button class="icon-btn sm" data-action="cat-move" data-id="${c.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Mover para cima">↑</button>
                    <button class="icon-btn sm" data-action="cat-move" data-id="${c.id}" data-d="1" ${i === s.categories.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓</button>
                    <button class="icon-btn sm" data-action="new-task" data-category="${c.id}" title="Nova tarefa nesta categoria">＋</button>
                    <button class="icon-btn sm" data-action="edit-category" data-id="${c.id}" title="Editar">✏️</button>
                    ${c.id !== 'cat-outros' ? `<button class="icon-btn sm" data-action="delete-category" data-id="${c.id}" title="Excluir">🗑️</button>` : ''}
                  </div>
                </div>
              </div>`;
            })
            .join('')}
          <button class="card cat-card cat-new" data-action="new-category"><span>＋</span>Criar categoria</button>
        </div>`;
    },
  };

  Actions['new-category'] = () => Categories.openForm();
  Actions['edit-category'] = (el) => Categories.openForm(el.dataset.id);
  Actions['delete-category'] = (el) => Categories.remove(el.dataset.id);
  Actions['cat-move'] = (el) => Categories.move(el.dataset.id, +el.dataset.d);
  Actions['open-category'] = (el) => {
    Object.assign(Tasks.filters, { category: el.dataset.id, status: 'pending', q: '' });
    window.TU.App.go('tasks');
  };

  window.TU.Categories = Categories;
  void Bus;
})();
