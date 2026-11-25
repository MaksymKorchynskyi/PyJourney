# Спостерігач

**Спостерігач** (Observer) — поведінковий патерн проєктування, який дає змогу одному об'єкту повідомляти про події будь-яку кількість інших об'єктів, що на ці події підписалися, і при цьому не знати, хто саме вони. За цією ідеєю працюють кнопки в GUI, обробники `logging`, сигнали Django, вебхуки та кнопка «повідомити, коли товар з'явиться».

## Що ви дізнаєтесь

- Яку проблему розв'язує Спостерігач і чому опитування або жорстко прописані виклики погано масштабуються
- Ролі в патерні: видавець, підписник і клієнт
- Як реалізувати Спостерігача в Python через `typing.Protocol` і через звичайні функції
- Як уникнути витоків пам'яті за допомогою слабких посилань
- Де Спостерігач уже є в стандартній бібліотеці (`logging`)
- Типові помилки: спільний список підписників, відписка під час сповіщення, підписник, що падає з винятком

## Суть патерна

Патерн задає залежність **«один до багатьох»**: коли один об'єкт (**видавець**, або *суб'єкт*) змінює стан чи з ним стається щось важливе, усі об'єкти, які попросили про це знати (**підписники**, або *спостерігачі*, *слухачі*), автоматично отримують сповіщення.

Видавець знає лише те, що в підписників є певний метод сповіщення. Він не знає їхніх класів, скільки їх і що вони робитимуть з отриманою новиною.

## Проблема

Уявіть інтернет-магазин. Коли розпроданий товар знову надходить на склад, мають зреагувати кілька частин системи:

- покупці, які натиснули «повідомити мене», мають отримати лист;
- пошуковий індекс має позначити товар як доступний;
- аналітика має зафіксувати поповнення.

Перша, наївна версія вшиває все це прямо в код складу (ескіз):

```python
class Inventory:
    def restock(self, product: str, quantity: int) -> None:
        ...  # оновити залишок
        # Склад знає кожного споживача на ім'я:
        email_service.send_back_in_stock(product)
        search_index.mark_available(product)
        analytics.track("restock", product)
```

Кожна нова реакція («а ще надішли повідомлення в Telegram») вимагає правити `Inventory`, хоча цей клас мав би дбати лише про залишки. Щоб його протестувати, потрібні всі ці сервіси, а перенесення в інший проєкт тягне їх за собою.

Протилежний підхід — **опитування** (polling): кожен сервіс раз на кілька секунд питає склад «клавіатура вже з'явилася?». Більшість таких запитів марні, а реакція запізнюється до наступного опитування.

Отже, або склад знає забагато, або всі інші марно витрачають зусилля на запитання.

## Рішення

Перетворіть склад на **видавця** з невеликим механізмом підписки:

1. список підписників;
2. публічні методи, щоб **підписатися** і **відписатися**;
3. метод **notify**, який проходить списком і викликає в кожного підписника один узгоджений метод (наприклад, `update(event)`).

Щойно стається щось цікаве, видавець викликає `notify()`. Він спілкується з підписниками лише через спільний інтерфейс, тому розсилку листів, пошуковий індекс і аналітику можна додавати, прибирати чи замінювати, не чіпаючи видавця. Підписники також можуть приєднуватися й виходити **під час виконання програми**.

Щоб підписники знали, що сталося, видавець передає їм контекст: об'єкт події, кілька аргументів або самого себе, щоб підписник сам прочитав потрібні дані.

## Аналогія з життя

Згадайте підписку на подкаст. Ви не заходите щоранку на сайт подкасту, щоб перевірити, чи вийшов новий випуск. Ви один раз натискаєте «підписатися», і нові випуски просто з'являються у вашому застосунку. Автор подкасту не знає вашого імені чи застосунку, він знає лише, що є список підписників, яким треба доставити випуск. Коли інтерес зникає, ви відписуєтеся, і випуски більше не надходять.

## Структура

```text
+-------------------------------+
| Publisher (напр. Inventory)   |
|-------------------------------|
| - subscribers: list           |
|-------------------------------|      notify(event):
| + subscribe(subscriber)       |          for s in subscribers:
| + unsubscribe(subscriber)     |              s.update(event)
| + notify(event) -----------------+
| + restock(...)   # бізнес     |  |
+-------------------------------+  |
                                   v
                 +-------------------------------+
                 | <<Protocol>> Subscriber       |
                 |-------------------------------|
                 | + update(event) -> None       |
                 +-------------------------------+
                       ^                  ^
                       : реалізує         :
           +-------------------+  +-------------------+
           | EmailNotifier     |  | SearchIndex       |
           | + update(event)   |  | + update(event)   |
           +-------------------+  +-------------------+

Клієнт: створює видавця й підписників, потім викликає subscribe().
```

1. **Видавець** (Publisher) зберігає цікавий стан і список підписників. Коли стається подія, він сповіщає всіх зі списку.
2. **Інтерфейс підписника** (Subscriber) оголошує метод сповіщення. Зазвичай це один метод, наприклад `update()`.
3. **Конкретні підписники** реагують на сповіщення кожен по-своєму. Усі вони дотримуються одного інтерфейсу, тому видавець не прив'язаний до їхніх класів.
4. **Дані про подію** передаються як аргументи методу сповіщення: об'єкт події, прості значення або посилання на видавця.
5. **Клієнт** окремо створює видавців і підписників та з'єднує їх.

## Реалізація на Python

Ось сценарій з магазином. `typing.Protocol` описує інтерфейс підписника *структурно*: підходить будь-який об'єкт із відповідним методом `update()`, успадкування не потрібне. Подія — невеликий заморожений dataclass, тож підписники не зможуть випадково її змінити.

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StockEvent:
    product: str
    quantity: int


class Subscriber(Protocol):
    def update(self, event: StockEvent) -> None: ...


class Inventory:
    """Видавець: володіє станом і повідомляє підписників про його зміни."""

    def __init__(self) -> None:
        self._stock: dict[str, int] = {}
        self._subscribers: list[Subscriber] = []

    def subscribe(self, subscriber: Subscriber) -> None:
        if subscriber not in self._subscribers:
            self._subscribers.append(subscriber)

    def unsubscribe(self, subscriber: Subscriber) -> None:
        self._subscribers.remove(subscriber)

    def notify(self, event: StockEvent) -> None:
        for subscriber in list(self._subscribers):  # ітеруємо по копії
            subscriber.update(event)

    def restock(self, product: str, quantity: int) -> None:
        was_empty = self._stock.get(product, 0) == 0
        self._stock[product] = self._stock.get(product, 0) + quantity
        print(f"Inventory: {product} -> {self._stock[product]} pcs")
        if was_empty:  # цікаво лише «знову в наявності»
            self.notify(StockEvent(product, self._stock[product]))


class EmailNotifier:
    def __init__(self, waiting: dict[str, list[str]]) -> None:
        self.waiting = waiting

    def update(self, event: StockEvent) -> None:
        for email in self.waiting.get(event.product, []):
            print(f"  Email to {email}: '{event.product}' is back in stock")


class SearchIndex:
    def update(self, event: StockEvent) -> None:
        print(f"  SearchIndex: mark '{event.product}' as available")


class Analytics:
    def __init__(self) -> None:
        self.restocks = 0

    def update(self, event: StockEvent) -> None:
        self.restocks += 1
        print(f"  Analytics: restock #{self.restocks} recorded")


inventory = Inventory()
emails = EmailNotifier({"keyboard": ["ann@example.com", "bob@example.com"]})
index = SearchIndex()
analytics = Analytics()

for subscriber in (emails, index, analytics):
    inventory.subscribe(subscriber)

inventory.restock("keyboard", 5)
inventory.restock("keyboard", 3)  # товар уже є: події немає

inventory.unsubscribe(emails)
inventory.restock("mouse", 10)
```

Результат:

```text
Inventory: keyboard -> 5 pcs
  Email to ann@example.com: 'keyboard' is back in stock
  Email to bob@example.com: 'keyboard' is back in stock
  SearchIndex: mark 'keyboard' as available
  Analytics: restock #1 recorded
Inventory: keyboard -> 8 pcs
Inventory: mouse -> 10 pcs
  SearchIndex: mark 'mouse' as available
  Analytics: restock #2 recorded
```

На що варто звернути увагу:

- `Inventory` ніде не імпортує й не згадує `EmailNotifier`, `SearchIndex` чи `Analytics`. Щоб додати четвертого підписника, змінювати його не треба.
- Видавець вирішує, **коли** подія варта сповіщення (лише якщо товар був розпроданий). Підписники вирішують, **що** робити.
- `notify()` ітерує по `list(self._subscribers)`, тобто по копії. Підписник може відписатися просто під час сповіщення, а зміна списку під час ітерації по ньому пропускає елементи (див. «Типові помилки»).
- Список підписників створюється в `__init__`, тому в кожного видавця він свій.

> **Зверніть увагу:** якщо вам ближче явне успадкування, оголосіть `class Subscriber(ABC)` з `@abstractmethod def update(...)`. Абстрактний клас не дасть створити екземпляр підкласу, який забув реалізувати `update()`. `Protocol` натомість перевіряють статичні аналізатори (mypy, pyright), і він дає змогу підключати класи, яких ви не контролюєте.

## Практичний приклад: емітер подій на функціях

У Python підписник не зобов'язаний бути об'єктом із методом `update()`. Підійде будь-який **об'єкт, що викликається** (callable): функція, лямбда, зв'язаний метод. Поширена «пайтонівська» форма — *емітер подій*, який зберігає обробники за назвою події й повертає функцію для відписки:

```python
from collections import defaultdict
from collections.abc import Callable
from typing import Any

Handler = Callable[..., None]


class EventEmitter:
    def __init__(self) -> None:
        self._handlers: defaultdict[str, list[Handler]] = defaultdict(list)

    def on(self, event: str, handler: Handler) -> Callable[[], None]:
        """Підписує обробник і повертає функцію, що скасовує підписку."""
        self._handlers[event].append(handler)

        def unsubscribe() -> None:
            self._handlers[event].remove(handler)

        return unsubscribe

    def emit(self, event: str, **data: Any) -> int:
        handlers = list(self._handlers.get(event, ()))
        for handler in handlers:
            handler(**data)
        return len(handlers)


class Editor:
    def __init__(self) -> None:
        self.events = EventEmitter()  # композиція замість успадкування
        self.filename: str | None = None

    def open(self, filename: str) -> None:
        self.filename = filename
        self.events.emit("open", filename=filename)

    def save(self) -> None:
        self.events.emit("save", filename=self.filename)


audit_log: list[str] = []
editor = Editor()

editor.events.on("open", lambda filename: audit_log.append(f"opened {filename}"))
stop_alerts = editor.events.on(
    "save", lambda filename: print(f"ALERT: {filename} was changed")
)

editor.open("report.txt")
editor.save()
stop_alerts()            # відписуємося
print(editor.events.emit("save", filename="report.txt"))  # ніхто не слухає
print(audit_log)
```

Результат:

```text
ALERT: report.txt was changed
0
['opened report.txt']
```

Рішення, ухвалені в цій версії:

- **Композиція.** `Editor` не успадковує базовий клас видавця, а *містить* `EventEmitter`. Це важливо, коли в класу вже є батьківський клас, і так код підписки живе в одному місці, яке легко перевикористати.
- **Іменовані події.** Підписники обирають події, які їх цікавлять (`"open"`, `"save"`), тож ніхто не отримує сповіщень, які все одно проігнорує.
- **Функція відписки.** Оскільки `on()` повертає замикання, викликачеві не треба зберігати початкову лямбду, щоб згодом її прибрати.
- `emit()` використовує `.get()`, тому генерування події, на яку ніхто не підписаний, не створює порожніх записів у `defaultdict`.

### Як уникнути витоків пам'яті за допомогою слабких посилань

Список видавця тримає **сильні посилання** на підписників. Доки живе видавець, живуть і підписники, навіть якщо решта програми про них давно забула. Це називають проблемою «забутого слухача» (lapsed listener): закрите вікно, яке не відписалося, і далі отримує події та займає пам'ять.

`weakref.WeakSet` зберігає посилання, які не утримують об'єкти «живими». Коли зникає останнє звичайне посилання, підписник тихо випадає з множини:

```python
import weakref


class Publisher:
    def __init__(self) -> None:
        self._subscribers: weakref.WeakSet = weakref.WeakSet()

    def subscribe(self, subscriber) -> None:
        self._subscribers.add(subscriber)

    def notify(self, message: str) -> None:
        for subscriber in list(self._subscribers):
            subscriber.update(message)


class Screen:
    def __init__(self, name: str) -> None:
        self.name = name

    def update(self, message: str) -> None:
        print(f"{self.name} shows: {message}")


news = Publisher()
main_screen = Screen("main")
popup = Screen("popup")
news.subscribe(main_screen)
news.subscribe(popup)
print(len(news._subscribers))

del popup  # спливне вікно закрито, більше ніхто на нього не посилається
print(len(news._subscribers))
news.notify("hello")
```

Результат:

```text
2
1
main shows: hello
```

> **Зверніть увагу:** у CPython об'єкт зникає, щойно його лічильник посилань падає до нуля, тож другий `len()` одразу дає `1`. В інших реалізаціях (PyPy) він може зникнути пізніше, після роботи збирача сміття. Порядок елементів у `WeakSet` не визначений. Для колбеків-методів використовуйте `weakref.WeakMethod`, бо звичайне `weakref.ref(obj.method)` «помирає» одразу: зв'язаний метод — тимчасовий об'єкт.

### Спостерігач у стандартній бібліотеці: `logging`

Ви вже користуєтеся Спостерігачем щоразу, коли налаштовуєте `logging`. Логер — це видавець, обробники (handlers) — підписники, а `addHandler()` / `removeHandler()` — методи підписки. Кожен обробник сам вирішує, що робити із записом:

```python
import logging
import sys

logger = logging.getLogger("shop")      # видавець
logger.setLevel(logging.INFO)
logger.propagate = False

console = logging.StreamHandler(sys.stdout)                 # підписник 1
console.setFormatter(logging.Formatter("console: %(message)s"))
errors_only = logging.StreamHandler(sys.stdout)             # підписник 2
errors_only.setLevel(logging.ERROR)
errors_only.setFormatter(logging.Formatter("pager: %(levelname)s %(message)s"))

logger.addHandler(console)
logger.addHandler(errors_only)

logger.info("order 42 created")
logger.error("payment for order 42 failed")
logger.removeHandler(console)
logger.error("database is down")
```

Результат:

```text
console: order 42 created
console: payment for order 42 failed
pager: ERROR payment for order 42 failed
pager: ERROR database is down
```

Інші приклади в екосистемі: прив'язування подій у `tkinter`, сигнали Django, бібліотека `blinker`, сигнали й слоти Qt, колбеки майбутніх результатів в `asyncio` (`add_done_callback`).

## Коли застосовувати

- Зміна одного об'єкта має викликати реакцію інших, а **набір цих об'єктів заздалегідь невідомий** або змінюється під час роботи програми.
- Ви пишете компонент для повторного використання (кнопку, завантажувач, модель) і хочете, щоб користувачі могли «вчепити» свій код без створення підкласів.
- Деяким об'єктам треба стежити за іншим лише **тимчасово** чи за певних умов, і вони мають могти припинити стеження.
- Ви хочете замінити опитування («вже змінилося?») на активні сповіщення.

Не використовуйте патерн, коли отримувач рівно один і він фіксований. Прямий виклик методу простіший і зрозуміліший.

## Кроки реалізації

1. Розділіть логіку на ядро (майбутній видавець) і реакції (майбутні підписники).
2. Оголосіть інтерфейс підписника: `Protocol` чи абстрактний клас з одним методом сповіщення або просто псевдонім типу `Callable`.
3. Вирішіть, які дані несе сповіщення: незмінюваний об'єкт події, іменовані аргументи чи самого видавця.
4. Розмістіть список підписників і методи `subscribe()` / `unsubscribe()` / `notify()` або в базовому класі, або, гнучкіше, в окремому допоміжному об'єкті, яким володіє видавець (композиція).
5. Викликайте `notify()` з бізнес-методів видавця щоразу, коли стається щось важливе для підписників. Ітеруйте по копії списку.
6. Реалізуйте конкретних підписників.
7. У клієнті створіть підписників і зареєструйте їх у видавців. Вирішіть, хто їх відписуватиме, або використайте слабкі посилання.

## Переваги та недоліки

**Переваги:**

- *Принцип відкритості/закритості*: нових підписників можна додавати, не змінюючи видавця.
- Слабке зчеплення: видавець залежить лише від крихітного інтерфейсу.
- Зв'язки між об'єктами встановлюються й розриваються під час виконання.
- Одна подія може запускати багато незалежних реакцій, кожну у власному класі чи функції.

**Недоліки:**

- Порядок сповіщення — деталь реалізації. Код, що покладається на «A дізнається раніше за B», крихкий.
- Потік керування прихований: з виклику `inventory.restock()` не видно, що саме станеться. Налагоджувати каскади подій буває складно.
- Забуті підписки спричиняють витоки пам'яті й «примарні» реакції.
- Виняток в одному підписнику може зупинити сповіщення решти, якщо його не обробити.
- Підписники, що змінюють видавця всередині `update()`, можуть спричинити нескінченний цикл сповіщень.

## Відносини з іншими патернами

- **Ланцюжок обов'язків, Команда, Посередник і Спостерігач** по-різному поєднують відправників і отримувачів. Ланцюжок обов'язків передає запит по ланцюгу, доки хтось його не обробить. Команда встановлює однонапрямлений зв'язок від відправника до отримувача. Посередник прибирає прямі зв'язки й змушує компоненти спілкуватися через центральний об'єкт. Спостерігач дає отримувачам змогу динамічно підписуватися й відписуватися.
- **Посередник проти Спостерігача.** Мета Посередника — прибрати взаємні залежності між набором компонентів. Мета Спостерігача — налаштувати динамічні однонапрямлені зв'язки. Популярний спосіб реалізувати Посередника — зробити його видавцем, на якого підписуються компоненти, і тоді патерни стають схожими. Але Посередника можна побудувати й без підписок, а в системі, де кожен компонент є видавцем, центрального посередника немає зовсім.
- **Спостерігач разом зі Стратегією чи Командою.** Колбек підписника часто є функцією в дусі Стратегії або об'єктом-командою, яку видавець запускає на кожну подію.

## Типові помилки

- **Список підписників як атрибут класу.** Змінюване значення на рівні класу спільне для всіх екземплярів, тож підписка на одного видавця означає підписку на всіх:

  ```python
  class Publisher:
      _observers: list = []  # ПОМИЛКА: один список на всі екземпляри

      def attach(self, observer) -> None:
          self._observers.append(observer)


  orders = Publisher()
  payments = Publisher()
  orders.attach("order-logger")
  print(payments._observers)
  ```

  Результат:

  ```text
  ['order-logger']
  ```

  Створюйте список у `__init__` (`self._observers = []`).

- **Зміна списку під час сповіщення.** Якщо підписник відписується всередині `update()`, цикл по «живому» списку пропускає наступного підписника:

  ```python
  class OneShot:
      def __init__(self, name: str, publisher: "Publisher") -> None:
          self.name = name
          self.publisher = publisher

      def update(self) -> None:
          print(f"{self.name} got the event and unsubscribes")
          self.publisher.subscribers.remove(self)


  class Publisher:
      def __init__(self) -> None:
          self.subscribers: list[OneShot] = []

      def notify(self) -> None:
          for subscriber in self.subscribers:  # ПОМИЛКА: список змінюється під час циклу
              subscriber.update()


  pub = Publisher()
  pub.subscribers += [OneShot("A", pub), OneShot("B", pub), OneShot("C", pub)]
  pub.notify()
  print("left:", [s.name for s in pub.subscribers])
  ```

  Результат:

  ```text
  A got the event and unsubscribes
  C got the event and unsubscribes
  left: ['B']
  ```

  `B` так і не отримав сповіщення. Ітеруйте по копії: `for subscriber in list(self.subscribers):`.

- **Один підписник із винятком ламає всіх.** Виняток вилітає з `notify()`, і решта підписників пропускається. Оберіть політику: перехоплювати й логувати або збирати помилки й піднімати їх разом:

  ```python
  def notify(subscribers, event: str) -> None:
      for subscriber in list(subscribers):
          try:
              subscriber(event)
          except Exception as exc:  # зламаний підписник не має зупиняти решту
              print(f"subscriber {subscriber.__name__} failed: {exc!r}")


  def broken(event: str) -> None:
      raise ValueError("boom")


  def healthy(event: str) -> None:
      print(f"healthy got {event!r}")


  notify([broken, healthy], "saved")
  ```

  Результат:

  ```text
  subscriber broken failed: ValueError('boom')
  healthy got 'saved'
  ```

- **Читання приватного стану видавця.** Підписник, який читає `subject._state`, прив'язаний до внутрішньої будови видавця. Передавайте об'єкт події або відкрийте публічну властивість лише для читання.
- **Цикли сповіщень.** Підписник, що змінює видавця всередині `update()`, запускає нове сповіщення, яке спричиняє нову зміну... Сповіщайте лише про справжні зміни (порівнюйте старе й нове значення) і не записуйте нічого у видавця з обробників.
- **Забута відписка.** Довгоживучі видавці утримують короткоживучих підписників. Відписуйтеся явно (наприклад, у методі `close()` чи блоці `with`) або використовуйте слабкі посилання.

## Підсумок

- Спостерігач встановлює зв'язок «один до багатьох»: видавець сповіщає всіх своїх поточних підписників, коли щось стається.
- Видавець знає лише інтерфейс підписника, тому він закритий для змін і відкритий для нових реакцій.
- У Python підписником може бути об'єкт із методом `update()` (`Protocol` чи абстрактний клас) або будь-який об'єкт, що викликається.
- Тримайте окремий список підписників у кожному екземплярі, ітеруйте по копії й вирішіть, як обробляти винятки підписників.
- Слабкі посилання (`weakref.WeakSet`, `weakref.WeakMethod`) не дають видавцю утримувати підписників «живими».
- Логери й обробники `logging` — готовий Спостерігач у стандартній бібліотеці.
- Не покладайтеся на порядок сповіщення й остерігайтеся прихованого потоку керування та циклів сповіщень.

## Практика

### Вправа 1: Термометр

Напишіть видавця `Thermometer` із властивістю `temperature`. Присвоєння властивості сповіщає підписників **лише тоді, коли значення справді змінилося**, і передає їм старе й нове значення. Напишіть двох підписників: `Display` виводить кожне нове значення, а `Alarm(limit)` виводить попередження лише тоді, коли температура *перетинає* межу вгору (а не на кожному значенні понад межу). Подайте значення `25, 25, 31, 32, 29`.

### Вправа 2: Одноразові підписки

Додайте до `EventEmitter` із практичного прикладу метод `once(event, handler)`. Обробник має спрацювати на першому відповідному `emit()`, а потім автоматично відписатися. Переконайтеся, що повернена функція все ще може скасувати підписку до настання події і що повторний виклик функції відписки не генерує винятку.

### Вправа 3: Звіт про всі збої

Напишіть `Publisher`, підписники якого — звичайні функції. `notify(event)` має викликати **кожного** підписника, навіть якщо деякі з них генерують винятки. Наприкінці, якщо щось пішло не так, підніміть `ExceptionGroup` (Python 3.11+) з усіма зібраними винятками, додавши до кожного примітку з іменем підписника. Обробіть групу через `except*` так, щоб мережеві помилки й решта оброблялися окремо.

## Розв'язки

### Вправа 1

```python
from typing import Protocol


class TemperatureListener(Protocol):
    def on_temperature(self, old: float | None, new: float) -> None: ...


class Thermometer:
    def __init__(self) -> None:
        self._temperature: float | None = None
        self._listeners: list[TemperatureListener] = []

    def subscribe(self, listener: TemperatureListener) -> None:
        self._listeners.append(listener)

    def unsubscribe(self, listener: TemperatureListener) -> None:
        self._listeners.remove(listener)

    @property
    def temperature(self) -> float | None:
        return self._temperature

    @temperature.setter
    def temperature(self, value: float) -> None:
        if value == self._temperature:
            return  # нічого не змінилося, нікого не турбуємо
        old, self._temperature = self._temperature, value
        for listener in list(self._listeners):
            listener.on_temperature(old, value)


class Display:
    def on_temperature(self, old: float | None, new: float) -> None:
        print(f"Display: {new:.1f} °C")


class Alarm:
    def __init__(self, limit: float) -> None:
        self.limit = limit

    def on_temperature(self, old: float | None, new: float) -> None:
        if new > self.limit and (old is None or old <= self.limit):
            print(f"Alarm: above {self.limit} °C!")


sensor = Thermometer()
sensor.subscribe(Display())
sensor.subscribe(Alarm(limit=30))

for value in (25, 25, 31, 32, 29):
    sensor.temperature = value
```

Результат:

```text
Display: 25.0 °C
Display: 31.0 °C
Alarm: above 30 °C!
Display: 32.0 °C
Display: 29.0 °C
```

Друге значення `25` нічого не виводить, бо сетер завершується одразу. Завдяки старому значенню `Alarm` бачить саме *перетин* межі й не спрацьовує і на `31`, і на `32`.

### Вправа 2

```python
from collections import defaultdict
from collections.abc import Callable
from typing import Any

Handler = Callable[..., None]


class EventEmitter:
    def __init__(self) -> None:
        self._handlers: defaultdict[str, list[Handler]] = defaultdict(list)

    def on(self, event: str, handler: Handler) -> Callable[[], None]:
        self._handlers[event].append(handler)

        def unsubscribe() -> None:
            if handler in self._handlers[event]:
                self._handlers[event].remove(handler)

        return unsubscribe

    def once(self, event: str, handler: Handler) -> Callable[[], None]:
        def wrapper(**data: Any) -> None:
            unsubscribe()  # спершу відписуємося, щоб повторний emit не викликав двічі
            handler(**data)

        unsubscribe = self.on(event, wrapper)
        return unsubscribe

    def emit(self, event: str, **data: Any) -> int:
        handlers = list(self._handlers.get(event, ()))  # копія: обробники можуть відписатися
        for handler in handlers:
            handler(**data)
        return len(handlers)


app = EventEmitter()
app.on("login", lambda user: print(f"audit: {user} logged in"))
app.once("login", lambda user: print(f"welcome tour for {user}"))

print(app.emit("login", user="olena"))
print(app.emit("login", user="olena"))
```

Результат:

```text
audit: olena logged in
welcome tour for olena
2
audit: olena logged in
1
```

`once()` підписує не сам обробник, а обгортку, яка спершу прибирає себе, а потім викликає обробник. Це працює лише тому, що `emit()` ітерує по копії списку. Перевірка `if handler in ...` робить функцію відписки безпечною для повторного виклику.

### Вправа 3

```python
from collections.abc import Callable

Subscriber = Callable[[str], None]


class Publisher:
    def __init__(self) -> None:
        self._subscribers: list[Subscriber] = []

    def subscribe(self, subscriber: Subscriber) -> None:
        self._subscribers.append(subscriber)

    def notify(self, event: str) -> None:
        errors: list[Exception] = []
        for subscriber in list(self._subscribers):
            try:
                subscriber(event)
            except Exception as exc:
                exc.add_note(f"raised by subscriber {subscriber.__name__}")
                errors.append(exc)
        if errors:
            raise ExceptionGroup(f"{len(errors)} subscriber(s) failed", errors)


def mailer(event: str) -> None:
    raise ConnectionError("SMTP server unavailable")


def cache(event: str) -> None:
    print(f"cache: invalidated after {event!r}")


def stats(event: str) -> None:
    raise KeyError(event)


pub = Publisher()
for subscriber in (mailer, cache, stats):
    pub.subscribe(subscriber)

try:
    pub.notify("price_changed")
except* ConnectionError as group:
    for exc in group.exceptions:
        print("network problem:", exc, exc.__notes__)
except* KeyError as group:
    for exc in group.exceptions:
        print("bug:", repr(exc), exc.__notes__)
```

Результат:

```text
cache: invalidated after 'price_changed'
network problem: SMTP server unavailable ['raised by subscriber mailer']
bug: KeyError('price_changed') ['raised by subscriber stats']
```

`cache` виконується, хоча `mailer` перед ним упав. `add_note()` (Python 3.11+) додає контекст, не змінюючи типу винятку, а `except*` розділяє групу за типами, тож кожен вид збою обробляється окремо.

---

*Джерела: [Refactoring.Guru — Спостерігач](https://refactoring.guru/design-patterns/observer), [Refactoring.Guru — Спостерігач на Python](https://refactoring.guru/design-patterns/observer/python/example). Адаптовано й доповнено для PyJourney.*
