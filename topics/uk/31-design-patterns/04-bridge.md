# Міст

**Міст** (Bridge) — це структурний патерн проєктування, що розділяє великий клас або набір тісно пов'язаних класів на дві окремі ієрархії: **абстракцію** та **реалізацію**. Їх поєднує посилання («міст»), і далі вони можуть розвиватися незалежно. Це стандартні ліки для ієрархії класів, яка росте одразу у двох напрямках і розмножується в десятки класів-комбінацій.

## Що ви дізнаєтесь

- Як «розширення у двох вимірах» через успадкування призводить до вибуху кількості класів
- Що в цьому патерні означають *абстракція* та *реалізація* (і чого вони не означають)
- Як побудувати міст на Python, замінивши успадкування композицією
- Практичний приклад: типи повідомлень і канали доставки як дві незалежні ієрархії
- Як змінювати реалізацію під час виконання
- Чим Міст відрізняється від Адаптера та Стратегії і де він перетинається з Абстрактною фабрикою та Будівельником

## Суть патерна

Міст відокремлює те, *що* об'єкт робить на високому рівні, від того, *як* низькорівнева робота виконується на конкретній платформі. Високорівнева сторона (абстракція) зберігає посилання на об'єкт низькорівневої сторони (реалізації) і делегує йому роботу. Кожна сторона має власну ієрархію класів, і будь-яка абстракція може працювати з будь-якою реалізацією.

## Проблема

Припустімо, у вас є клас `Shape` із двома підкласами: `Circle` і `Square`. Тепер вам потрібні кольори, і ви плануєте варіанти `Red` і `Blue`. Оскільки фігур уже дві, знадобиться чотири класи: `RedCircle`, `BlueCircle`, `RedSquare`, `BlueSquare`. Додайте трикутник — і потрібно ще два. Додайте зелений колір — ще три. Кількість класів дорівнює *добутку* вимірів:

```python
from itertools import product

shapes = ["Circle", "Square", "Triangle"]
colors = ["Red", "Blue", "Green"]

combined = [color + shape for shape, color in product(shapes, colors)]
print(len(combined), "subclasses:", ", ".join(combined))
print(len(shapes) + len(colors), "classes if the dimensions are kept separate")
```

Результат:

```text
9 subclasses: RedCircle, BlueCircle, GreenCircle, RedSquare, BlueSquare, GreenSquare, RedTriangle, BlueTriangle, GreenTriangle
6 classes if the dimensions are kept separate
```

Корінь проблеми в тому, що класи фігур розширюються у **двох незалежних вимірах** — за формою та за кольором — лише за допомогою успадкування. Успадкування охайно нарощує ієрархію тільки вздовж однієї осі. Кожна додаткова вісь множить кількість класів.

Те саме трапляється в реальних застосунках. Графічний інтерфейс (один вимір: простий вигляд для клієнтів, детальний для адміністраторів), який працює на кількох операційних системах (другий вимір: Windows, Linux, macOS), швидко перетворюється на клубок умов або на сітку з `CustomerWindowsView`, `AdminLinuxView` і так далі. Щоб щось змінити, доводиться розібратися в усьому клубку.

## Рішення

Міст пропонує перейти від успадкування до **композиції**. Винесіть один із вимірів в окрему ієрархію класів, а початкові класи нехай *посилаються* на об'єкт цієї ієрархії замість того, щоб містити весь її стан і поведінку.

Для фігур винесіть колір в окрему ієрархію `Color` з підкласами `Red` і `Blue`. `Shape` отримує поле з посиланням на об'єкт кольору й делегує йому все, що стосується кольору. Це посилання і є мостом. Відтепер новий колір не зачіпає ієрархію фігур, а нова фігура не зачіпає ієрархію кольорів: 3 + 3 класи замість 3 × 3.

### Абстракція і реалізація

Оригінальний опис патерна (у книжці «Банди чотирьох») використовує два слова, що звучать страшніше, ніж є насправді:

- **Абстракція** (її ще називають *інтерфейсом*) — це високорівневий керівний шар для чогось. Сама вона справжньої роботи не виконує, а делегує її шару реалізації.
- **Реалізація** (її ще називають *платформою*) — шар, що виконує фактичну низькорівневу роботу.

Це **не** те саме, що абстрактні класи чи `Protocol` у Python. Це ролі. У реальному застосунку абстракцією може бути GUI, а реалізацією — API операційної системи, який GUI викликає, коли користувач щось натискає. Тоді застосунок можна розширювати у двох незалежних напрямках: додавати інтерфейси (для клієнтів, для адміністраторів) і додавати платформи (Windows, Linux, macOS). Об'єкти GUI делегують роботу тому об'єкту платформи, який їм передали, тож той самий GUI працює всюди, а підтримка ще однієї ОС означає один новий клас в ієрархії реалізації.

## Аналогія з життя

Згадайте органи керування автомобілем і його двигун. Інтерфейс водія — це кермо, педалі та селектор передач. Він однаковий, хай під капотом бензиновий, дизельний чи електричний двигун, і двигун можна замінити іншим типом, не перепроєктовуючи панель. Виробники також пропонують «спортивний» салон із підкермовими пелюстками та кнопкою launch control. Це розширена абстракція: вона додає органи керування, але й далі керує тим двигуном, який установлено, через те саме з'єднання. Салони й двигуни розробляють різні команди, і будь-який салон можна поєднати з будь-яким двигуном.

## Структура

```text
+------------------------------+  bridge  +------------------------------+
|         Abstraction          |<>------->|        <<interface>>         |
|------------------------------|          |        Implementation        |
| - impl: Implementation       |          |------------------------------|
| + feature1()                 |          | + method1()                  |
| + feature2()                 |          | + method2()                  |
+------------------------------+          | + method3()                  |
               ^                          +------------------------------+
               | inherits                        ^                ^
+------------------------------+                 |   implements   |
|      RefinedAbstraction      |   +--------------------+ +--------------------+
|------------------------------|   | ConcreteImplA      | | ConcreteImplB      |
| + feature3()                 |   | (platform A code)  | | (platform B code)  |
+------------------------------+   +--------------------+ +--------------------+

feature1():
    self.impl.method1()        # високорівнева логіка на основі низькорівневих примітивів
    self.impl.method2()

Client:
    abstraction = RefinedAbstraction(ConcreteImplA())   # клієнт поєднує обидві сторони
```

1. **Абстракція** (Abstraction) містить високорівневу логіку керування. Фактичну низькорівневу роботу вона доручає об'єкту реалізації.
2. **Реалізація** (Implementation) оголошує інтерфейс, спільний для всіх конкретних реалізацій. Абстракція спілкується з реалізацією лише через ці методи. Інтерфейси не мусять збігатися: зазвичай реалізація пропонує *примітивні* операції, а абстракція будує на них операції *вищого рівня*.
3. **Конкретні реалізації** (Concrete Implementations) містять платформозалежний код.
4. **Розширені абстракції** (Refined Abstractions) надають варіанти логіки керування. Як і батьківський клас, вони працюють з будь-якою реалізацією через інтерфейс реалізації.
5. **Клієнт** (Client) зазвичай працює лише з абстракцією, але саме він пов'язує абстракцію з об'єктом реалізації.

## Реалізація на Python

Пульти керування (абстракція) і пристрої (реалізація). Кожен пульт працює з кожним пристроєм через загальний інтерфейс пристрою, тож пульти й пристрої можна розробляти окремо.

```python
from abc import ABC, abstractmethod


class Device(ABC):
    """Реалізація: примітивні операції, які підтримує кожен пристрій."""

    def __init__(self) -> None:
        self.enabled = False
        self.channel = 1
        self._volume = 30

    @property
    def volume(self) -> int:
        return self._volume

    @volume.setter
    def volume(self, percent: int) -> None:
        self._volume = max(0, min(100, percent))  # пристрій сам стежить за своїм діапазоном

    @abstractmethod
    def status(self) -> str: ...


class Tv(Device):
    def status(self) -> str:
        power = "on" if self.enabled else "off"
        return f"TV {power}, channel {self.channel}, volume {self.volume}%"


class Radio(Device):
    def status(self) -> str:
        power = "on" if self.enabled else "off"
        frequency = 87.5 + (self.channel - 1) * 0.5
        return f"Radio {power}, {frequency:.1f} FM, volume {self.volume}%"


class RemoteControl:
    """Абстракція: високорівневе керування з делегуванням пристрою."""

    def __init__(self, device: Device) -> None:
        self.device = device  # міст

    def toggle_power(self) -> None:
        self.device.enabled = not self.device.enabled

    def volume_up(self) -> None:
        self.device.volume += 10

    def volume_down(self) -> None:
        self.device.volume -= 10

    def channel_up(self) -> None:
        self.device.channel += 1

    def channel_down(self) -> None:
        self.device.channel = max(1, self.device.channel - 1)


class AdvancedRemoteControl(RemoteControl):
    """Розширена абстракція: нові можливості, але лише через інтерфейс Device."""

    def mute(self) -> None:
        self.device.volume = 0

    def jump_to(self, channel: int) -> None:
        self.device.channel = channel


def evening(remote: RemoteControl) -> None:
    # Клієнт працює з будь-яким пультом і будь-яким пристроєм.
    remote.toggle_power()
    remote.channel_up()
    remote.channel_up()
    remote.volume_up()
    print(remote.device.status())


evening(RemoteControl(Tv()))
evening(RemoteControl(Radio()))

advanced = AdvancedRemoteControl(Radio())
evening(advanced)
advanced.mute()
advanced.jump_to(42)
print(advanced.device.status())
```

Результат:

```text
TV on, channel 3, volume 40%
Radio on, 88.5 FM, volume 40%
Radio on, 88.5 FM, volume 40%
Radio on, 108.0 FM, volume 0%
```

Два пульти й два пристрої дають чотири робочі комбінації за чотирьох класів. Третій пристрій (скажімо, проєктор) одразу працюватиме з обома пультами, а третій пульт — з усіма пристроями.

Оскільки зв'язок — це просто атрибут, реалізацію можна замінити й **під час виконання**:

```python
# Продовження попереднього прикладу
advanced.device = Tv()  # спрямовуємо той самий пульт на інший пристрій
advanced.toggle_power()
advanced.jump_to(7)
for _ in range(10):
    advanced.volume_up()  # телевізор обмежує гучність значенням 100
print(advanced.device.status())
```

Результат:

```text
TV on, channel 7, volume 100%
```

> **Зверніть увагу:** заміна під час виконання необов'язкова. Головне в Мості — *структурний* поділ на дві незалежні ієрархії. Саме тому його так часто плутають зі Стратегією, суть якої якраз у заміні поведінки під час виконання. Патерн — це не лише розташування класів: він ще й підказує читачам, яку задачу ви розв'язуєте.

## Практичний приклад: сповіщення через різні канали

Сервіс надсилає кілька видів сповіщень: звичайні повідомлення, термінові попередження й нагадування. Кожне має доставлятися електронною поштою, SMS або в командний чат. Лише з успадкуванням це 3 × 3 = 9 класів, і кожен новий канал додає ще три. З Мостом *вид* сповіщення (що сказати й як сформулювати) — це абстракція, а *канал* (як доставити, з усіма його обмеженнями) — реалізація.

```python
from abc import ABC, abstractmethod


class MessageSender(ABC):
    """Реалізація: як повідомлення фізично доставляється."""

    @abstractmethod
    def deliver(self, to: str, subject: str, body: str) -> str: ...


class EmailSender(MessageSender):
    def deliver(self, to: str, subject: str, body: str) -> str:
        return f"email to {to} | Subject: {subject} | {body}"


class SmsSender(MessageSender):
    LIMIT = 40  # канал сам знає свої обмеження

    def deliver(self, to: str, subject: str, body: str) -> str:
        text = f"{subject}: {body}"
        if len(text) > self.LIMIT:
            text = text[: self.LIMIT - 3] + "..."
        return f"sms to {to} | {text}"


class ChatSender(MessageSender):
    def __init__(self, channel: str) -> None:
        self.channel = channel

    def deliver(self, to: str, subject: str, body: str) -> str:
        return f"chat #{self.channel} | @{to} *{subject}* {body}"


class Notification:
    """Абстракція: вирішує, що сказати, а доставку делегує."""

    def __init__(self, sender: MessageSender) -> None:
        self.sender = sender

    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, "Notice", message)


class UrgentNotification(Notification):
    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, "URGENT", message.upper() + "!")


class ReminderNotification(Notification):
    def __init__(self, sender: MessageSender, when: str) -> None:
        super().__init__(sender)
        self.when = when

    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, f"Reminder for {self.when}", message)


for sender in (EmailSender(), SmsSender(), ChatSender("ops")):
    print(Notification(sender).notify("olena", "Invoice 42 is ready"))
    print(UrgentNotification(sender).notify("olena", "Disk is 95% full"))
    print(ReminderNotification(sender, "Fri 10:00").notify("taras", "Team retro in room 3"))
```

Результат:

```text
email to olena | Subject: Notice | Invoice 42 is ready
email to olena | Subject: URGENT | DISK IS 95% FULL!
email to taras | Subject: Reminder for Fri 10:00 | Team retro in room 3
sms to olena | Notice: Invoice 42 is ready
sms to olena | URGENT: DISK IS 95% FULL!
sms to taras | Reminder for Fri 10:00: Team retro in...
chat #ops | @olena *Notice* Invoice 42 is ready
chat #ops | @olena *URGENT* DISK IS 95% FULL!
chat #ops | @taras *Reminder for Fri 10:00* Team retro in room 3
```

Дев'ять комбінацій, шість класів. Подивіться, як розподілено обов'язки:

- Класи сповіщень відповідають за **формулювання**: тему, великі літери, час нагадування. Про обмеження SMS чи синтаксис чату вони нічого не знають.
- Класи відправників відповідають за **доставку**: формат, обмеження довжини, назви каналів. Про терміновість чи нагадування вони нічого не знають.

Щоб додати push-сповіщення, потрібен один новий підклас `MessageSender`, і всі три види сповіщень одразу його підтримуватимуть.

## Коли застосовувати

- **Ви хочете розділити й упорядкувати монолітний клас, що має кілька варіантів певної функціональності**, наприклад клас, який уміє працювати з різними серверами баз даних. Що більшим стає такий клас, то важче його зрозуміти, а зміна одного варіанта може зламати інші. Міст розбиває його на ієрархії, які можна змінювати незалежно.
- **Клас потрібно розширювати в кількох ортогональних (незалежних) вимірах.** Винесіть окрему ієрархію для кожного виміру, а початковий клас нехай делегує відповідну роботу об'єктам цих ієрархій.
- **Реалізацію потрібно змінювати під час виконання.** Це необов'язково, але просто: абстракція отримує новий об'єкт у поле реалізації.

Типові реальні випадки: кросплатформні застосунки, підтримка кількох рушіїв баз даних чи файлових систем, код, що працює з кількома постачальниками однотипного API (хмарні платформи, платіжні провайдери, соціальні мережі).

## Кроки реалізації

1. Визначте ортогональні виміри у своїх класах: абстракція/платформа, предметна область/інфраструктура, фронтенд/бекенд, інтерфейс/реалізація.
2. З'ясуйте, які операції потрібні клієнтові, і визначте їх у базовому класі абстракції.
3. Визначте операції, доступні на всіх платформах. Ті з них, що потрібні абстракції, оголосіть у загальному інтерфейсі реалізації (`ABC` або `Protocol`).
4. Створіть класи конкретних реалізацій для кожної платформи; усі вони мають дотримуватися інтерфейсу реалізації.
5. Додайте до класу абстракції поле з типом реалізації. Абстракція делегує більшу частину роботи об'єкту в цьому полі.
6. Якщо варіантів високорівневої логіки кілька, створіть розширені абстракції, успадкувавши базову абстракцію.
7. Клієнт передає об'єкт реалізації в конструктор абстракції, щоб поєднати їх. Після цього він працює лише з абстракцією.

## Переваги та недоліки

| Переваги | Недоліки |
|---|---|
| Платформонезалежні класи й застосунки. | Застосування до класу з високою зв'язністю лише додає непрямості й складності. |
| Клієнт працює з високорівневими абстракціями й не бачить деталей платформи. | Інтерфейс реалізації треба ретельно продумати: він має задовольняти кожну абстракцію. |
| *Принцип відкритості/закритості*: нові абстракції й реалізації додаються незалежно. | Додатковий шар делегування трохи ускладнює читання коду. |
| *Принцип єдиного обов'язку*: високорівнева логіка — в абстракції, деталі платформи — в реалізації. | Найкраще закладати його заздалегідь; вбудувати в заплутану ієрархію потім — непросто. |

## Зв'язки з іншими патернами

- **Міст** зазвичай проєктують заздалегідь, щоб частини застосунку можна було розробляти незалежно. **Адаптер** зазвичай додають до наявного застосунку, щоб змусити несумісні класи співпрацювати.
- **Міст**, **Стан**, **Стратегія** й до певної міри **Адаптер** мають дуже схожу структуру: усі вони побудовані на композиції та делегуванні. Але розв'язують вони різні задачі, і назва патерна повідомляє, яку саме.
- **Абстрактна фабрика** добре поєднується з Мостом, коли деякі абстракції можуть працювати лише з певними реалізаціями. Фабрика інкапсулює допустимі пари й приховує їх від клієнта.
- **Будівельника** можна поєднати з Мостом: директор грає роль абстракції, а різні будівельники — роль реалізацій.

## Типові помилки

- **Інтерфейс реалізації просто віддзеркалює абстракцію.** Якби `Device` мав `toggle_power()`, `mute()` і `jump_to()`, кожен пристрій заново реалізовував би логіку пульта. Дайте реалізації *примітиви* (прапорець увімкнення, гучність, канал), а операції вищого рівня будуйте в абстракції.
- **Абстракція перевіряє, яка в неї реалізація.** Код на кшталт `if isinstance(self.device, Radio): ...` у пульті знову зв'язує дві ієрархії. Якщо абстракції щось потрібно, додайте це до інтерфейсу реалізації.
- **Створення реалізації всередині абстракції.** `self.device = Tv()` у `RemoteControl.__init__` жорстко фіксує одну комбінацію. Нехай реалізацію передає клієнт.
- **Міст для одного виміру.** Якщо клас змінюється лише в одному напрямку, вистачить звичайного успадкування або callable у дусі Стратегії. Міст окупається, коли є дві незалежні осі змін.
- **Удавати, що виміри незалежні, коли це не так.** Якщо допустимі лише деякі пари, забезпечте це явно, наприклад Абстрактною фабрикою, а не чекайте, поки неприпустимі комбінації впадуть під час виконання.

## Підсумок

- Міст розділяє одну ієрархію, що змінюється у двох вимірах, на дві ієрархії, поєднані композицією.
- Абстракція містить високорівневу логіку й делегує низькорівневу роботу об'єкту реалізації через спільний інтерфейс.
- «Абстракція» та «реалізація» — це ролі, а не абстрактні класи Python. Типові пари: GUI/ОС, предметна область/інфраструктура, тип повідомлення/канал доставки.
- Кількість класів зростає як сума (M + N), а не як добуток (M × N), і кожну сторону можна розширювати, не чіпаючи іншу.
- Реалізацію можна замінити під час виконання, присвоївши новий об'єкт, але суть патерна — у структурному поділі.
- На діаграмі Міст схожий на Стратегію та Адаптер; відрізняє їх намір.

## Практика

### Вправа 1: Фігури та кольори

Реалізуйте приклад із розділу *Проблема*. `Color` — реалізація з методом `fill() -> str` (`Red` повертає `"red"`, `Blue` — `"blue"`). `Shape` — абстракція з методом `draw() -> str`. `Circle(color, radius)` малює `"circle r=2 filled with red"`, а `Square(color, side)` — `"square 3x3 filled with blue"`. Потім додайте `Green`, **не змінюючи жодного класу фігур**, і виведіть усі комбінації фігур і кольорів.

### Вправа 2: Розплутайте документи

Перетворіть цей код на міст. Документи (`Invoice`, `Receipt`) мають бути абстракцією. Рендерери (`HtmlRenderer`, `TextRenderer`) — реалізацією з примітивами `heading(text)` і `line(label, value)`. Потім додайте `MarkdownRenderer` і покажіть, що обидва документи підтримують його без змін.

```python
class HtmlInvoice:
    def render(self, number: int, total: float) -> str:
        return f"<h1>Invoice {number}</h1><p>Total: {total:.2f}</p>"


class TextInvoice:
    def render(self, number: int, total: float) -> str:
        return f"INVOICE {number}\nTotal: {total:.2f}"


class HtmlReceipt:
    def render(self, number: int, total: float) -> str:
        return f"<h1>Receipt {number}</h1><p>Paid: {total:.2f}</p><p>Thank you!</p>"


class TextReceipt:
    def render(self, number: int, total: float) -> str:
        return f"RECEIPT {number}\nPaid: {total:.2f}\nThank you!"
```

### Вправа 3: Репозиторії поверх сховищ

Створіть `UserRepository` (абстракцію), що зберігає користувачів через `StorageBackend` (реалізацію) з трьома примітивами: `put(key, value)`, `get(key)` і `keys()`. Значення — рядки, тож репозиторій сам серіалізує користувачів у JSON. Підготуйте два сховища: `MemoryBackend` (словник) і `SqliteBackend` (база `sqlite3` у пам'яті з таблицею «ключ — значення»). Репозиторію потрібні методи `add(user_id, name, email)` і `find_by_domain(domain) -> list[str]`, побудовані лише на примітивах. Виконайте той самий сценарій з обома сховищами.

## Розв'язки

### Вправа 1

```python
from abc import ABC, abstractmethod


class Color(ABC):
    @abstractmethod
    def fill(self) -> str: ...


class Red(Color):
    def fill(self) -> str:
        return "red"


class Blue(Color):
    def fill(self) -> str:
        return "blue"


class Shape(ABC):
    def __init__(self, color: Color) -> None:
        self.color = color

    @abstractmethod
    def draw(self) -> str: ...


class Circle(Shape):
    def __init__(self, color: Color, radius: float) -> None:
        super().__init__(color)
        self.radius = radius

    def draw(self) -> str:
        return f"circle r={self.radius} filled with {self.color.fill()}"


class Square(Shape):
    def __init__(self, color: Color, side: float) -> None:
        super().__init__(color)
        self.side = side

    def draw(self) -> str:
        return f"square {self.side}x{self.side} filled with {self.color.fill()}"


# Додано пізніше: жоден клас фігур не змінився.
class Green(Color):
    def fill(self) -> str:
        return "green"


for color in (Red(), Blue(), Green()):
    print(Circle(color, radius=2).draw())
    print(Square(color, side=3).draw())
```

Результат:

```text
circle r=2 filled with red
square 3x3 filled with red
circle r=2 filled with blue
square 3x3 filled with blue
circle r=2 filled with green
square 3x3 filled with green
```

### Вправа 2

```python
from abc import ABC, abstractmethod


class Renderer(ABC):
    """Реалізація: низькорівневі примітиви форматування."""

    @abstractmethod
    def heading(self, text: str) -> str: ...

    @abstractmethod
    def line(self, label: str, value: str) -> str: ...

    def join(self, parts: list[str]) -> str:
        return "\n".join(parts)


class HtmlRenderer(Renderer):
    def heading(self, text: str) -> str:
        return f"<h1>{text}</h1>"

    def line(self, label: str, value: str) -> str:
        return f"<p>{label}{': ' if value else ''}{value}</p>"

    def join(self, parts: list[str]) -> str:
        return "".join(parts)


class TextRenderer(Renderer):
    def heading(self, text: str) -> str:
        return text.upper()

    def line(self, label: str, value: str) -> str:
        return f"{label}: {value}" if value else label


class Document(ABC):
    """Абстракція: вирішує, що показати, а форматування делегує."""

    def __init__(self, renderer: Renderer) -> None:
        self.renderer = renderer

    @abstractmethod
    def render(self, number: int, total: float) -> str: ...


class Invoice(Document):
    def render(self, number: int, total: float) -> str:
        r = self.renderer
        return r.join([r.heading(f"Invoice {number}"), r.line("Total", f"{total:.2f}")])


class Receipt(Document):
    def render(self, number: int, total: float) -> str:
        r = self.renderer
        return r.join([
            r.heading(f"Receipt {number}"),
            r.line("Paid", f"{total:.2f}"),
            r.line("Thank you!", ""),
        ])


class MarkdownRenderer(Renderer):  # нова платформа: один клас, і її підтримує кожен документ
    def heading(self, text: str) -> str:
        return f"## {text}"

    def line(self, label: str, value: str) -> str:
        return f"- **{label}** {value}".rstrip()


for renderer in (HtmlRenderer(), TextRenderer(), MarkdownRenderer()):
    for document in (Invoice(renderer), Receipt(renderer)):
        print(document.render(17, 249.5))
    print()
```

Результат:

```text
<h1>Invoice 17</h1><p>Total: 249.50</p>
<h1>Receipt 17</h1><p>Paid: 249.50</p><p>Thank you!</p>

INVOICE 17
Total: 249.50
RECEIPT 17
Paid: 249.50
Thank you!

## Invoice 17
- **Total** 249.50
## Receipt 17
- **Paid** 249.50
- **Thank you!**
```

HTML і текстовий результат збігаються з тим, що давали чотири початкові класи. Чотири класи-комбінації перетворилися на 2 + 2 класи, а третій рендерер коштував один клас замість двох.

### Вправа 3

```python
import json
import sqlite3
from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Реалізація: примітивні операції «ключ — значення»."""

    @abstractmethod
    def put(self, key: str, value: str) -> None: ...

    @abstractmethod
    def get(self, key: str) -> str | None: ...

    @abstractmethod
    def keys(self) -> list[str]: ...


class MemoryBackend(StorageBackend):
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def put(self, key: str, value: str) -> None:
        self._data[key] = value

    def get(self, key: str) -> str | None:
        return self._data.get(key)

    def keys(self) -> list[str]:
        return sorted(self._data)


class SqliteBackend(StorageBackend):
    def __init__(self) -> None:
        self._db = sqlite3.connect(":memory:")
        self._db.execute("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)")

    def put(self, key: str, value: str) -> None:
        with self._db:
            self._db.execute("INSERT OR REPLACE INTO kv VALUES (?, ?)", (key, value))

    def get(self, key: str) -> str | None:
        row = self._db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def keys(self) -> list[str]:
        return [key for (key,) in self._db.execute("SELECT key FROM kv ORDER BY key")]


class UserRepository:
    """Абстракція: операції предметної області на основі примітивів сховища."""

    def __init__(self, backend: StorageBackend) -> None:
        self.backend = backend

    def add(self, user_id: int, name: str, email: str) -> None:
        self.backend.put(f"user:{user_id}", json.dumps({"name": name, "email": email}))

    def find_by_domain(self, domain: str) -> list[str]:
        found = []
        for key in self.backend.keys():
            raw = self.backend.get(key)
            if raw is None:
                continue
            user = json.loads(raw)
            if user["email"].endswith("@" + domain):
                found.append(user["name"])
        return found


for backend in (MemoryBackend(), SqliteBackend()):
    repo = UserRepository(backend)
    repo.add(1, "Olena", "olena@example.com")
    repo.add(2, "Taras", "taras@test.org")
    repo.add(3, "Iryna", "iryna@example.com")
    print(f"{type(backend).__name__}: {repo.find_by_domain('example.com')}")
```

Результат:

```text
MemoryBackend: ['Olena', 'Iryna']
SqliteBackend: ['Olena', 'Iryna']
```

`UserRepository` містить логіку предметної області в одному екземплярі. Підтримка ще одного рушія зберігання (файли, Redis, хмарне сховище «ключ — значення») — це ще одне сховище з трьома методами. А новий репозиторій (скажімо, для замовлень) одразу використовує всі наявні сховища.

---

*Джерела: [Refactoring.Guru — Міст](https://refactoring.guru/design-patterns/bridge), [Refactoring.Guru — Міст на Python](https://refactoring.guru/design-patterns/bridge/python/example). Адаптовано й доповнено для PyJourney.*
