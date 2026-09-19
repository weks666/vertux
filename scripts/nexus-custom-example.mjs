// Small, explicitly synthetic workspaces. No account or external data is used.
export function customExample({tr, icon}) {
  const examples = [
    {
      id:'cinema', tab:['Для себя','Personal'], title:['Мой кино-дневник','My film journal'],
      description:['Сохраняйте просмотренные фильмы, даты и свои оценки.','Keep the films you watched, their dates and your ratings.'],
      column:['Фильм / дата просмотра','Film / date watched'], value:['Оценка','Rating'], metric:['Просмотрено','Watched'],
      hint:['Отметьте фильмы — счётчик обновится.','Tick a film to update the count.'],
      rows:[['Интерстеллар','Interstellar','5 сентября','5 September','9 / 10',true],['Дюна','Dune','12 сентября','12 September','8 / 10',true],['Начало','Inception','19 сентября','19 September','8 / 10',false]],
      summary:['Личная библиотека, к которой удобно возвращаться.','A personal library you can come back to.']
    },
    {
      id:'project', tab:['Для проекта','Projects'], title:['Ремонт кухни','Kitchen renovation'],
      description:['План на неделю: задачи, сроки и готовность рядом.','Your weekly plan: tasks, due dates and progress together.'],
      column:['Задача / срок','Task / due date'], value:['Ответственный','Owner'], metric:['Готово','Completed'],
      hint:['Завершите задачу — прогресс изменится.','Complete a task to update your progress.'],
      rows:[['Снять замеры','Measure the room','18 сентября','18 September','Я',true,'Me'],['Выбрать освещение','Choose lighting','20 сентября','20 September','Я',false,'Me'],['Заказать материалы','Order materials','23 сентября','23 September','Я',false,'Me']],
      summary:['Нужные этапы и детали под конкретный проект.','The stages and details your project needs.']
    },
    {
      id:'team', tab:['Для команды','Teams'], title:['Заявки мастерской','Workshop orders'],
      description:['Что ремонтируем, кому обещали и когда нужно выдать.','What needs repairing, who it is for and when it is due.'],
      column:['Заказ / клиент','Order / customer'], value:['Выдать','Due'], metric:['Выдано','Delivered'],
      hint:['Отметьте выданный заказ — он учтётся в итоге.','Mark a delivered order to update the total.'],
      rows:[['Замена аккумулятора','Battery replacement','№ 1042 · Анна','No. 1042 · Anna','19 сент.',true,'19 Sep'],['Чистка ноутбука','Laptop cleaning','№ 1043 · Максим','No. 1043 · Max','20 сент.',false,'20 Sep'],['Ремонт экрана','Screen repair','№ 1044 · Ирина','No. 1044 · Irina','22 сент.',false,'22 Sep']],
      summary:['Заказы и договорённости видны всей команде.','Orders and commitments are visible to your team.']
    }
  ];
  return `<div class="nx-custom-example" data-custom-example>
    <div class="nx-custom-tabs" role="tablist" aria-label="Примеры Custom Workspace" data-nx-aria-en="Custom Workspace examples">${examples.map((example,i)=>`<button type="button" role="tab" id="custom-tab-${example.id}" data-custom-choice="${example.id}" aria-controls="custom-panel-${example.id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${tr(...example.tab)}</button>`).join('')}</div>
    ${examples.map((example,i)=>`<div class="nx-custom-panel" id="custom-panel-${example.id}" role="tabpanel" aria-labelledby="custom-tab-${example.id}"${i?' hidden':''}>
      <div class="nx-custom-heading"><div><h3>${tr(...example.title)}</h3><p>${tr(...example.description)}</p></div><div class="nx-custom-total"><span>${tr(...example.metric)}</span><strong data-custom-count aria-live="polite">${example.rows.filter(row=>row[5]).length} / 3</strong></div></div>
      <div class="nx-custom-columns"><span>${tr(...example.column)}</span><span>${tr(...example.value)}</span></div>
      <ul class="nx-custom-rows">${example.rows.map(([ru,en,date,dateEn,value,done,valueEn])=>`<li><label><input type="checkbox" data-custom-done${done?' checked':''} aria-label="${ru}: ${example.metric[0].toLowerCase()}" data-nx-aria-en="${en}: ${example.metric[1].toLowerCase()}"><span class="nx-custom-check" aria-hidden="true">${icon('check')}</span><span class="nx-custom-item"><strong>${tr(ru,en)}</strong><small>${tr(date,dateEn)}</small></span></label><span class="nx-custom-value">${valueEn?tr(value,valueEn):value}</span></li>`).join('')}</ul>
      <div class="nx-custom-progress" aria-hidden="true"><i data-custom-progress style="width:${example.rows.filter(row=>row[5]).length/3*100}%"></i></div>
      <p class="nx-custom-hint">${tr(...example.hint)}</p><p class="nx-custom-summary">${tr(...example.summary)}</p>
    </div>`).join('')}
  </div>`;
}
