import fs from 'node:fs';
import {collectCatalog} from './locale-lib.mjs';
import {webRoot} from './paths.mjs';
const source = JSON.parse(fs.readFileSync(webRoot+'/generated/source.json'));
// Short display labels, reviewed in a 160 x 128 viewport. Protocol/brand IDs stay unchanged.
const ru = {
  Address:'Адрес', 'All Reset':'Сброс мот.', AriaSettings:'Настр. Aria',
  'Aria2.4GhzCh':'Кан. 2.4G', AriaSubgigCh:'Кан. 900M', Band:'Диапазон',
  Blue:'Синий', BluetoothEna:'Bluetooth', Calibration:'Калибровка', CCT:'Цв. темп.',
  CH:'Китайский', Close:'Закр.', 'Dim Fine':'Димм. точн.', Dimmer:'Диммер',
  'Display Flip':'Перев. экр.', 'Display Mode':'Подсветка', 'Display Reverse':'Перев. экр.',
  'DMX Settings':'Настр. DMX', Effect:'Эффект', EN:'Английский',
  Factory:'Зав. настр.', 'Factory Restore':'Зав. сброс', FALSE:'Ошибка',
  'Fan:':'Вент.:', Focus:'Фокус', Green:'Зелёный', 'Head Temp':'Темп. гол.',
  Hold:'Удерж.', Host:'Ведущий', Hue:'Оттенок', Info:'Инфо', Information:'Информация',
  Language:'Язык', 'LED-B':'LED синий', 'LED-Dim':'LED димм.', 'LED-Eff':'LED эффект',
  'LED-G':'LED зелён.', 'LED-R':'LED красн.', 'LED-Spd':'LED скор.', Macro:'Цв. макрос',
  MainMenu:'Меню', Manu:'Ручн.', Manual:'Вручную', Mode:'Каналы', Motor:'Мотор',
  No:'Нет', 'No DMX':'Нет DMX', Off:'Выкл.', OFF:'Норм.', On:'Вкл.', ON:'Перев.',
  'On Time':'Время вкл.', Open:'Откр.', 'P/T Correction':'Корр. P/T', Pan:'Панорама',
  'Pan Invert':'Инв. Pan', Panel:'Панель', PanFine:'Pan точн.', Pers:'Наст.',
  Personality:'Настройки', Pri:'Вед.', 'Pri/Sec Mode':'Вед./ведом.', Primary:'Ведущий',
  Prog:'Прог.', Program:'Программа', 'Program Speed':'Скорость', PTSpeed:'Скор. P/T', 'Primary %d':'Вед. %d',
  Red:'Красный', Reset:'Сброс', Rotate:'Вращение', Run:'Пуск', RunMode:'Режим',
  Saturati:'Насыщ.', Sec:'Ведом.', Secondary:'Ведомый', Sensitivity:'Чувствит.',
  Show:'Всегда', Sound:'Звук', SoundMode:'Звук. режим', Strobe:'Строб',
  'Target Mode':'Реж. цели', 'Temp:':'Темп.:', Temperature:'Температура',
  Tilt:'Наклон', 'Tilt Fine':'Tilt точн.', 'Tilt Invert':'Инв. Tilt', 'Total Time':'Всего часов',
  TRUE:'Норма', Version1:'Версия 1', Version2:'Версия 2', White:'Белый', Yes:'Да',
  Zoom:'Зум', ZoomRo:'Вращ. зума', ZoomRotate:'Вращ. зума', '60s':'60с',
};
for (let i=1;i<=8;i++) ru[`Program ${i}`] = `Прог. ${i}`;
const zh = {
  '...':'...', DMX:'DMX', Pers:'设置', Prog:'程序', Manu:'手动', Info:'信息',
  Pan:'水平', Tilt:'垂直', Red:'红色', Green:'绿色', Blue:'蓝色', White:'白色',
  Dimmer:'调光', Focus:'调焦', Zoom:'变焦', Rotate:'旋转', ZoomRotate:'变焦旋转',
  'Tilt Fine':'垂直微调', Sensitivity:'声控灵敏度', 'P/T Correction':'XY轴校正',
  Primary:'主机', Secondary:'从机', Pri:'主机', Sec:'从机', '20CH':'20CH', '26CH':'26CH',
  No:'否', Yes:'是', 'All Reset':'全部复位', 'Primary %d':'主机 %d',
};
for (let i=1;i<=8;i++) zh[`Program ${i}`] = `程序 ${i}`;
const catalog=collectCatalog(source);
for(const key of Object.keys(ru)) if(!catalog.some(e=>e.en===key)) throw Error(key);
const languages=[
  {id:'zh', label:'中文 · 共享点阵', strings:Object.fromEntries(catalog.map(e=>[e.en,zh[e.en]??e.zh]))},
  {id:'ru', label:'Русский · 共享点阵', strings:Object.fromEntries(catalog.map(e=>[e.en,ru[e.en]??e.en]))},
];
fs.writeFileSync(webRoot+'/locales/overrides.json', JSON.stringify({languages},null,2)+'\n');
