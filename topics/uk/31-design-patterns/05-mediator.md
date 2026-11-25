# Посередник

**Посередник** (Mediator, також відомий як *Intermediary* або *Controller*) — поведінковий патерн проєктування, який приборкує клубок об'єктів, що викликають одне одного. Він забороняє цим об'єктам спілкуватися напряму й змушує їх співпрацювати лише через один особливий об'єкт — посередника. За цією ідеєю влаштовані діалогові вікна, чати, диспетчерська служба аеропорту та шини повідомлень.

## Що ви дізнаєтесь

- Яку проблему розв'язує Посередник і чому павутину прямих зв'язків між об'єктами важко змінювати й повторно використовувати
- Ролі в патерні: компоненти, інтерфейс посередника й конкретний посередник
- Як реалізувати Посередника в Python: від класичної структури до реалістичної діалогової форми
- Як та сама ідея виглядає у вигляді чату й шини подій і де проходить межа зі Спостерігачем
- Чим Посередник відрізняється від Фасаду та Спостерігача
- Типові помилки: неприв'язані компоненти, нескінченні цикли сповіщень, непомітні одруківки в назвах подій і посередник — «божественний об'єкт»

## Суть патерна

Зменшити хаотичні залежності між об'єктами. Замість того щоб кожен об'єкт тримав посилання на інші й викликав їх напряму, кожен об'єкт (**компонент**) лише повідомляє **посередникові**, що з ним сталося. Посередник знає, як компоненти мають працювати разом, і вирішує, хто має відреагувати.

Компоненти нічого не знають одне про одного. Відправник не знає, хто обробить його сповіщення, а отримувач не знає, хто його спричинив.

## Проблема

Візьмімо діалог для створення й редагування профілю клієнта. Він складається з елементів форми: текстових полів, прапорців, кнопок. Деякі елементи впливають на інші:

- позначка «У мене є собака» відкриває приховане поле для клички собаки;
- кнопка «Надіслати» має перевірити всі видимі поля, перш ніж дані буде збережено;
- введення тексту в поле може ховати старе повідомлення про помилку.

Найпростіша реалізація вкладає цю логіку в самі елементи:

```python
class DogCheckbox:
    def __init__(self) -> None:
        self.checked = False
        self.dog_name_field: "TextField | None" = None  # знає конкретного сусіда

    def toggle(self) -> None:
        self.checked = not self.checked
        if self.dog_name_field is not None:
            self.dog_name_field.visible = self.checked  # напряму змінює інший віджет


class TextField:
    def __init__(self, label: str) -> None:
        self.label = label
        self.value = ""
        self.visible = True


class SubmitButton:
    def __init__(self, fields: list[TextField]) -> None:
        self.fields = fields  # знає кожне поле саме цієї форми

    def click(self) -> None:
        empty = [f.label for f in self.fields if f.visible and not f.value]
        print("missing:", empty if empty else "nothing, saving")


name = TextField("name")
dog_name = TextField("dog name")
dog_name.visible = False
has_dog = DogCheckbox()
has_dog.dog_name_field = dog_name
submit = SubmitButton([name, dog_name])

name.value = "Olena"
has_dog.toggle()
submit.click()
```

Результат:

```text
missing: ['dog name']
```

Це працює, але подивіться на залежності. `DogCheckbox` тримає посилання на конкретне текстове поле, а `SubmitButton` — список полів саме цієї форми. Використати такий прапорець в іншій формі не вийде, бо він наполягає на тому, щоб показувати поле з кличкою собаки. Кнопку теж не вийде, бо вона перевіряє профіль. Зрештою можна взяти або всі ці класи разом, або жодного.

Із ростом застосунку кожне нове правило додає ще один зв'язок між елементами. Для `n` компонентів кількість можливих прямих зв'язків зростає як `n * (n - 1) / 2`, тож у десяти елементів їх може бути аж 45:

```text
 Прямі зв'язки: усі знають усіх             Посередник: зірка з одним центром

   [Checkbox]------[DogName]                    [Checkbox]     [DogName]
      |    \        /    |                            \         /
      |     [Submit]     |                             [Dialog]
      |    /        \    |                            /   |    \
   [Name]----------[Email]                     [Submit] [Name] [Email]
```

## Рішення

Припиніть будь-яке пряме спілкування між компонентами, які хочете зробити незалежними. Компонент, якому є що сказати, викликає **метод сповіщення посередника**, а посередник перенаправляє виклик потрібним компонентам. Тепер кожен компонент залежить від одного об'єкта, а не від десятка колег.

У прикладі з профілем природний посередник — **сам діалог**. Він і так створює всі свої елементи й знає про них, тож відповідальність за їхню співпрацю не додає йому нових залежностей.

Найбільше змінюються самі елементи. Кнопка «Надіслати» більше нічого не перевіряє: її єдине завдання — сказати діалогу «мене натиснули». Далі діалог сам виконує перевірку або доручає її полям. Прапорець не показує жодних полів: він повідомляє «мене перемкнули», а діалог вирішує, що це означає *саме в цьому діалозі*.

Зв'язаність можна послабити ще більше, якщо винести спільний **інтерфейс посередника** з цим методом сповіщення. Тоді кнопка працюватиме з *будь-яким* діалогом, що реалізує інтерфейс, і той самий клас кнопки можна використати у формі профілю, у формі входу й у вікні налаштувань.

Уся складна павутина зв'язків опиняється в одному місці — у посереднику. Що менше залежностей має клас, то легше його змінювати, розширювати й використовувати повторно.

## Аналогія з життя

Пілоти літаків, що заходять на посадку чи злітають, не домовляються між собою, хто сідає першим. Вони спілкуються лише з диспетчером у вежі. Без диспетчера кожному пілотові довелося б стежити за всіма літаками поблизу й узгоджувати черговість із комітетом незнайомців, і закінчилося б це погано.

Зверніть увагу: вежа не керує літаками й не контролює весь політ. Вона лише забезпечує дотримання правил у завантаженій зоні довкола аеропорту, де учасників надто багато, щоб кожен міг домовлятися з усіма. Добрий посередник такий самий: він координує, а не виконує роботу за всіх.

## Структура

```text
                     +--------------------------------+
                     | <<Protocol>> Mediator          |
                     |--------------------------------|
                     | + notify(sender, event)        |
                     +--------------------------------+
                          ^                    ^
               реалізує   :                    | кожен компонент тримає
                          :                    | посилання типу Mediator
+-------------------------------+   +-------------------------------+
| ConcreteMediator              |   | Component (базовий)           |
|-------------------------------|   |-------------------------------|
| - component_a                 |   | # mediator: Mediator          |
| - component_b                 |   +-------------------------------+
| - component_c                 |       ^           ^           ^
|-------------------------------|       |           |           |
| + notify(sender, event):      |  +---------+ +---------+ +---------+
|     if sender is a: b.do_x()  |  | CompA   | | CompB   | | CompC   |
|     if sender is c: a.do_y()  |  +---------+ +---------+ +---------+
+-------------------------------+
        | знає конкретні компоненти й викликає їхні методи
        +--------------------------> CompA, CompB, CompC
```

1. **Компоненти** — класи з певною бізнес-логікою. Кожен тримає посилання на посередника, оголошене через **інтерфейс посередника**, тож не знає його конкретного класу. Прив'яжіть компонент до іншого посередника — і він працюватиме в іншій програмі.
2. **Інтерфейс посередника** описує, як компоненти спілкуються з посередником. Зазвичай це один метод сповіщення. Разом із ним компоненти можуть передавати будь-який контекст, зокрема самих себе, але так, щоб компонент-отримувач не став залежним від класу відправника.
3. **Конкретний посередник** інкапсулює зв'язки між компонентами. Зазвичай він тримає посилання на всі компоненти, якими керує, а іноді навіть створює й знищує їх.
4. Компоненти не повинні знати про інші компоненти. Якщо з компонентом або всередині нього стається щось важливе, він лише сповіщає посередника. Посередник може визначити відправника, і часто цього досить, щоб вирішити, кого запустити далі. Для компонента решта системи — чорна скринька.

## Реалізація на Python

### Структура в чистому вигляді

Ця версія повторює класичний концептуальний приклад: два компоненти, посередник, що реагує на частину їхніх подій, і клієнт, який запускає операції.

```python
from abc import ABC, abstractmethod


class Mediator(ABC):
    """Інтерфейс, через який компоненти повідомляють, що з ними сталося."""

    @abstractmethod
    def notify(self, sender: object, event: str) -> None: ...


class BaseComponent:
    """Зберігає посилання на посередника, і нічого більше."""

    def __init__(self, mediator: Mediator | None = None) -> None:
        self.mediator = mediator


# Конкретні компоненти виконують свою роботу й звітують посередникові.
# Вони не знають ні одне одного, ні конкретного класу посередника.
class Component1(BaseComponent):
    def do_a(self) -> None:
        print("Component 1 does A.")
        self.mediator.notify(self, "A")

    def do_b(self) -> None:
        print("Component 1 does B.")
        self.mediator.notify(self, "B")


class Component2(BaseComponent):
    def do_c(self) -> None:
        print("Component 2 does C.")
        self.mediator.notify(self, "C")

    def do_d(self) -> None:
        print("Component 2 does D.")
        self.mediator.notify(self, "D")


class ConcreteMediator(Mediator):
    """Тут живуть усі правила «хто на що реагує»."""

    def __init__(self, component1: Component1, component2: Component2) -> None:
        self._component1 = component1
        self._component2 = component2
        component1.mediator = self  # зворотний зв'язок компонентів із посередником
        component2.mediator = self

    def notify(self, sender: object, event: str) -> None:
        if event == "A":
            print("Mediator reacts on A and triggers following operations:")
            self._component2.do_c()
        elif event == "D":
            print("Mediator reacts on D and triggers following operations:")
            self._component1.do_b()
            self._component2.do_c()
        # про "B" і "C" теж повідомляють, але жодне правило на них не реагує


c1 = Component1()
c2 = Component2()
mediator = ConcreteMediator(c1, c2)

print("Client triggers operation A.")
c1.do_a()
print()
print("Client triggers operation D.")
c2.do_d()
```

Результат:

```text
Client triggers operation A.
Component 1 does A.
Mediator reacts on A and triggers following operations:
Component 2 does C.

Client triggers operation D.
Component 2 does D.
Mediator reacts on D and triggers following operations:
Component 1 does B.
Component 2 does C.
```

Як розгортається другий сценарій: клієнт викликає `c2.do_d()`. Компонент 2 виконує свою роботу й повідомляє `"D"`. Правило посередника для `"D"` каже «тепер B, потім C», тож він викликає `c1.do_b()` і `c2.do_c()`. Кожен із цих методів повідомляє власну подію (`"B"`, `"C"`), але для них у посередника правил немає, і ланцюжок зупиняється. Жоден компонент не імпортував, не називав і не викликав іншого.

Кілька деталей навмисно відрізняються від версії, яку часто можна побачити в посібниках:

- **`@abstractmethod` на `notify()`.** Клас, що просто успадковує `ABC`, сам по собі не стає абстрактним. Без декоратора підклас посередника, який забув реалізувати `notify()`, створюється без жодних заперечень і мовчки ковтає всі події:

  ```python
  from abc import ABC, abstractmethod


  class LooseMediator(ABC):  # як у багатьох посібниках: без @abstractmethod
      def notify(self, sender: object, event: str) -> None:
          pass


  class StrictMediator(ABC):
      @abstractmethod
      def notify(self, sender: object, event: str) -> None: ...


  class ForgotNotify(LooseMediator):
      pass


  class AlsoForgotNotify(StrictMediator):
      pass


  print(ForgotNotify().notify(None, "A"))  # мовчки нічого не робить
  try:
      AlsoForgotNotify()
  except TypeError as exc:
      print("TypeError:", exc)
  ```

  Результат:

  ```text
  None
  TypeError: Can't instantiate abstract class AlsoForgotNotify without an implementation for abstract method 'notify'
  ```

- **`Mediator | None = None`.** Якщо значення за замовчуванням — `None`, підказка типу має допускати `None`. Запис `mediator: Mediator = None` вводить в оману інструменти перевірки типів.
- **Звичайний атрибут замість властивості.** Гетер і сетер, які лише читають і записують `self._mediator`, нічого не додають. Почніть зі звичайного атрибута, а якщо колись знадобиться перевірка, перетворіть його на властивість (property): код, що його використовує, не зміниться.
- **Порядок визначень.** Компоненти визначено до `ConcreteMediator`, тож його анотації посилаються на вже наявні імена. В оригінальному прикладі вони визначені пізніше, тому там потрібен `from __future__ import annotations`. Починаючи з Python 3.14, анотації обчислюються ліниво (PEP 649), і такі посилання наперед більше не спричиняють помилок навіть без цього імпорту.

### Реалістичний приклад: діалог автентифікації

Тепер випадок, ближчий до життя: діалог, що перемикається між режимами «Вхід» (Log in) і «Реєстрація» (Register). Прапорець перемикає режим, тобто показує одну групу текстових полів і ховає іншу. Кнопка OK залежно від режиму або перевіряє облікові дані, або створює обліковий запис. Введення тексту в будь-яке поле прибирає попередню помилку.

Елементи універсальні: `Button`, `Textbox` і `Checkbox` нічого не знають ні про вхід, ні про e-mail, ні одне про одного. Усі правила живуть в `AuthenticationDialog`, який створює елементи й передає їм себе як посередника:

```python
from typing import Protocol


class Mediator(Protocol):
    def notify(self, sender: "Component", event: str) -> None: ...


class Component:
    """Елемент інтерфейсу. Його єдиний канал зв'язку зі світом — посередник."""

    def __init__(self, name: str, dialog: Mediator) -> None:
        self.name = name
        self.dialog = dialog
        self.visible = True

    def click(self) -> None:
        self.dialog.notify(self, "click")


class Button(Component):
    pass


class Textbox(Component):
    def __init__(self, name: str, dialog: Mediator) -> None:
        super().__init__(name, dialog)
        self.text = ""

    def enter(self, text: str) -> None:
        self.text = text
        self.dialog.notify(self, "keypress")


class Checkbox(Component):
    def __init__(self, name: str, dialog: Mediator) -> None:
        super().__init__(name, dialog)
        self.checked = False

    def check(self) -> None:
        self.checked = not self.checked
        self.dialog.notify(self, "check")


class AuthenticationDialog:
    """Конкретний посередник: створює елементи й володіє всіма правилами між ними."""

    def __init__(self, users: dict[str, str]) -> None:
        self.users = users
        self.title = ""
        self.error = ""
        self.logged_in: str | None = None
        # Кожен компонент отримує посередника (self) у конструкторі.
        self.login_or_register = Checkbox("login_or_register", self)
        self.login_username = Textbox("login_username", self)
        self.login_password = Textbox("login_password", self)
        self.reg_username = Textbox("reg_username", self)
        self.reg_password = Textbox("reg_password", self)
        self.reg_email = Textbox("reg_email", self)
        self.ok = Button("ok", self)
        self.login_or_register.check()  # починаємо в режимі "Log in"

    def notify(self, sender: Component, event: str) -> None:
        match (sender.name, event):
            case ("login_or_register", "check"):
                self._switch_mode(login=self.login_or_register.checked)
            case ("ok", "click"):
                self._submit()
            case (_, "keypress"):
                self.error = ""  # під час введення стара помилка зникає

    def _switch_mode(self, login: bool) -> None:
        self.title = "Log in" if login else "Register"
        self.error = ""
        for box in (self.login_username, self.login_password):
            box.visible = login
        for box in (self.reg_username, self.reg_password, self.reg_email):
            box.visible = not login

    def _submit(self) -> None:
        if self.login_or_register.checked:
            name, password = self.login_username.text, self.login_password.text
            if self.users.get(name) == password:
                self.logged_in = name
            else:
                self.error = "Wrong username or password"
        else:
            name = self.reg_username.text
            if "@" not in self.reg_email.text:
                self.error = "Invalid e-mail"
            else:
                self.users[name] = self.reg_password.text
                self.logged_in = name

    def render(self) -> None:
        visible = [c.name for c in vars(self).values()
                   if isinstance(c, Textbox) and c.visible]
        print(f"[{self.title}] fields={visible} error={self.error!r} user={self.logged_in}")


dialog = AuthenticationDialog(users={"olena": "s3cret"})
dialog.render()

dialog.login_username.enter("olena")
dialog.login_password.enter("wrong")
dialog.ok.click()
dialog.render()

dialog.login_or_register.check()        # перемикаємося на реєстрацію
dialog.render()
dialog.reg_username.enter("max")
dialog.reg_password.enter("qwerty")
dialog.reg_email.enter("max-at-example.com")
dialog.ok.click()
dialog.render()
dialog.reg_email.enter("max@example.com")
dialog.render()
dialog.ok.click()
dialog.render()
```

Результат:

```text
[Log in] fields=['login_username', 'login_password'] error='' user=None
[Log in] fields=['login_username', 'login_password'] error='Wrong username or password' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='Invalid e-mail' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=max
```

На що звернути увагу:

- **Один канал зв'язку.** Компонент завжди викликає лише `self.dialog.notify(self, event)`. `Textbox.enter()` не знає, що введення тексту має прибирати помилку. Це правило належить цьому діалогу, а інший діалог може на `"keypress"` робити щось інше або нічого.
- **Посередник створює свої компоненти** й передає себе в конструктор кожного. Це поширений спосіб встановити зв'язок. Звідси також випливає, що посередник може отримувати сповіщення *ще під час власного `__init__`*: виклик `self.login_or_register.check()` уже проходить через `notify()`, тому компоненти створено раніше за нього.
- **`match` за `(sender.name, event)`** (Python 3.10+) робить диспетчеризацію пласкою й читабельною. Зіставлення за назвою добре підходить для елементів інтерфейсу, які й так мають ідентифікатори. Інший варіант — порівнювати ідентичність: `if sender is self.ok and event == "click"`, як у розв'язках вправ нижче.
- Протокол `Mediator` робить елементи придатними для повторного використання: їх може «приймати» будь-який об'єкт із відповідним методом `notify()`. Успадковувати якийсь базовий клас діалогу не потрібно.

## Практичний приклад: чат

Чат — хрестоматійний посередник. Користувачі ніколи не тримають посилань одне на одного. Вони надсилають усе в кімнату, а кімната вирішує, хто що отримає: усі, одна людина через `@name` або ніхто, якщо відправникові заборонено писати (mute).

```python
from typing import Protocol


class Room(Protocol):
    def send(self, sender: "User", text: str) -> None: ...


class User:
    """Компонент: уміє говорити й слухати, але не має посилань на інших користувачів."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.room: Room | None = None

    def say(self, text: str) -> None:
        if self.room is None:
            raise RuntimeError(f"{self.name} has not joined a room")
        self.room.send(self, text)

    def receive(self, author: str, text: str) -> None:
        print(f"  {self.name:<6} <- {author}: {text}")


class ChatRoom:
    """Посередник: правила доставки (усім, @приватно, mute) живуть лише тут."""

    def __init__(self) -> None:
        self._members: dict[str, User] = {}
        self._muted: set[str] = set()

    def join(self, user: User) -> None:
        self._broadcast("system", f"{user.name} joined")
        self._members[user.name] = user
        user.room = self

    def mute(self, name: str) -> None:
        self._muted.add(name)

    def send(self, sender: User, text: str) -> None:
        if sender.name in self._muted:
            sender.receive("system", "you are muted")
        elif text.startswith("@"):
            target, _, body = text[1:].partition(" ")
            if target in self._members:
                self._members[target].receive(sender.name, f"(private) {body}")
            else:
                sender.receive("system", f"no user named {target!r}")
        else:
            self._broadcast(sender.name, text, skip=sender.name)

    def _broadcast(self, author: str, text: str, skip: str = "") -> None:
        for name, member in self._members.items():
            if name != skip:
                member.receive(author, text)


room = ChatRoom()
olena, max_, ira = User("olena"), User("max"), User("ira")
for user in (olena, max_, ira):
    room.join(user)

print("olena says hi:")
olena.say("hi all")
print("max whispers:")
max_.say("@ira lunch?")
max_.say("@bob are you here?")
print("ira is muted:")
room.mute("ira")
ira.say("SPAM SPAM SPAM")
```

Результат:

```text
  olena  <- system: max joined
  olena  <- system: ira joined
  max    <- system: ira joined
olena says hi:
  max    <- olena: hi all
  ira    <- olena: hi all
max whispers:
  ira    <- max: (private) lunch?
  max    <- system: no user named 'bob'
ira is muted:
  ira    <- system: you are muted
```

Усі правила доставки (розсилка всім, приватні повідомлення, невідомі отримувачі, заборона писати) живуть у `ChatRoom`. Щоб додати «повільний режим», фільтр лайки чи історію повідомлень, ви змінюєте кімнату, а не користувачів. Щоб дати користувачам зовсім інші правила, ви пишете інший клас кімнати, а `User` лишається як є. Саме це робить вправа 3.

Кімната також керує членством: `join()` прив'язує користувача до посередника, встановлюючи `user.room`. Поки користувач не приєднався, посередника в нього немає, і `say()` генерує зрозумілу помилку, а не падає з `AttributeError` на `None`.

### Посередник на основі Спостерігача: шина подій

Популярний спосіб реалізувати посередника — зробити його **видавцем**, на якого підписуються компоненти. Компоненти ніколи не викликають одне одного. Вони публікують події в шину й підписуються на ті події, які їх цікавлять:

```python
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class OrderPlaced:
    order_id: int
    item: str
    total: float


@dataclass(frozen=True)
class PaymentFailed:
    order_id: int
    item: str


class EventBus:
    """Посередник як видавець: компоненти підписуються на типи подій."""

    def __init__(self) -> None:
        self._handlers: defaultdict[type, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event: object) -> None:
        for handler in list(self._handlers[type(event)]):
            handler(event)


class Inventory:
    def __init__(self, bus: EventBus) -> None:
        bus.subscribe(OrderPlaced, self.reserve)
        bus.subscribe(PaymentFailed, self.release)

    def reserve(self, event: OrderPlaced) -> None:
        print(f"Inventory: reserved {event.item} for order {event.order_id}")

    def release(self, event: PaymentFailed) -> None:
        print(f"Inventory: released {event.item}")


class Billing:
    def __init__(self, bus: EventBus, balance: float) -> None:
        self.bus = bus
        self.balance = balance
        bus.subscribe(OrderPlaced, self.charge)

    def charge(self, event: OrderPlaced) -> None:
        if event.total > self.balance:
            print(f"Billing: order {event.order_id} declined")
            self.bus.publish(PaymentFailed(event.order_id, event.item))
        else:
            self.balance -= event.total
            print(f"Billing: charged {event.total}, balance {self.balance}")


bus = EventBus()
Inventory(bus)
Billing(bus, balance=100)

bus.publish(OrderPlaced(1, "keyboard", 60))
bus.publish(OrderPlaced(2, "monitor", 250))
```

Результат:

```text
Inventory: reserved keyboard for order 1
Billing: charged 60, balance 40
Inventory: reserved monitor for order 2
Billing: order 2 declined
Inventory: released monitor
```

`Inventory` і `Billing` знають лише шину та класи подій. `Billing` не викликає `inventory.release()`. Він оголошує `PaymentFailed`, і реагує той, кого це стосується.

Ця версія показує, чому Посередника й Спостерігача легко сплутати. Порівняйте її з діалогом:

- В `AuthenticationDialog` **правила належать посередникові**: лише він знає, що кнопка OK означає «увійти або зареєструватися». Це Посередник у класичній формі, і підписок у ньому немає взагалі.
- В `EventBus` шина лише маршрутизує повідомлення, а правила («на `PaymentFailed` звільнити товар») розкидані по підписниках. Що більше логіки виходить із центру, то більше дизайн стає звичайним Спостерігачем.

Обидва варіанти законні. Центральний посередник легше читати: усі взаємодії зібрані в одному місці. Шину легше розширювати: нова реакція — це просто ще один підписник. Про підписки, відписку й слабкі посилання див. тему Спостерігач.

### Де трапляється Посередник

- **Код графічного інтерфейсу.** Це найпоширеніше застосування патерна в Python. Клас вікна чи діалогу (у tkinter, Qt чи будь-якому іншому інструментарії) створює віджети, під'єднує їхні колбеки до власних методів і координує їх.
- **MVC.** *Контролер* (Controller) у Model-View-Controller часто відіграє роль посередника між поданням і моделлю: подання повідомляє про дії користувача, а контролер вирішує, як змінюється модель і що показує подання.
- **Брокери й шини повідомлень** (RabbitMQ, Kafka, шина подій усередині процесу) стають посередниками між сервісами, які ніколи не викликають одне одного напряму.
- **Оркестратори.** Оркестратор робочого процесу чи «саги», що каже сервісам оплати, складу й доставки, що робити далі, — це посередник на рівні архітектури.

## Коли застосовувати

- Деякі класи **важко змінювати**, бо вони тісно пов'язані з багатьма іншими класами. Посередник збирає всі ці зв'язки в одному класі, і зміна в одному компоненті більше не розходиться хвилями по інших.
- Компонент **неможливо використати повторно** в іншій програмі, бо він залежить від надто багатьох інших компонентів. Після рефакторингу компонентові потрібен лише якийсь посередник, тож у новому контексті можна дати йому інший.
- Ви створюєте **багато підкласів компонентів** лише для того, щоб той самий базовий компонент поводився по-різному в різних контекстах («прапорець, що показує поле для собаки», «прапорець, що вмикає поле e-mail»). З посередником правила співпраці переїжджають у класи посередників, а компоненти лишаються універсальними.

Не застосовуйте патерн для двох-трьох об'єктів з однією простою взаємодією. Прямий виклик простіше відстежити, ніж сповіщення, яке йде через центральний об'єкт.

## Кроки реалізації

1. Знайдіть групу тісно пов'язаних класів, яким не завадило б стати незалежнішими (простіше супроводження, простіше повторне використання).
2. Оголосіть інтерфейс посередника: `Protocol` або абстрактний клас. Здебільшого вистачає одного методу на кшталт `notify(sender, event)`. Саме цей інтерфейс дає змогу використовувати компоненти з іншими посередниками.
3. Реалізуйте конкретного посередника. Варто тримати в ньому посилання на всі його компоненти, щоб будь-яке правило могло дістатися будь-якого компонента.
4. За бажанням зробіть посередника відповідальним за створення й знищення компонентів. Тоді він почне нагадувати фабрику або фасад.
5. Дайте кожному компонентові посилання на посередника. Зазвичай його передають у конструктор компонента.
6. Змініть компоненти так, щоб вони викликали метод сповіщення посередника замість методів інших компонентів. Код, який раніше викликав інші компоненти, перенесіть у посередника й виконуйте його, коли надходить відповідне сповіщення.

## Переваги та недоліки

**Переваги:**

- *Принцип єдиного обов'язку*: взаємодія між компонентами винесена в одне місце, де її легше зрозуміти й підтримувати.
- *Принцип відкритості/закритості*: можна додавати нових посередників, тобто нові способи співпраці компонентів, не змінюючи самих компонентів.
- Зчеплення між компонентами різко зменшується: кожен залежить від одного інтерфейсу, а не від багатьох класів.
- Окремі компоненти стає легше використовувати повторно в інших контекстах.

**Недоліки:**

- З часом посередник може розростися в **«божественний об'єкт»** (God object), який усе знає й усім керує. Його розмір — ціна простоти компонентів.
- Потік керування стає непрямим. Щоб зрозуміти, що робить натискання кнопки, доводиться читати посередника, а не кнопку.
- Посередник — центральна точка, від якої залежить усе: помилка в ньому зачіпає кожну взаємодію.

## Відносини з іншими патернами

- **Ланцюжок обов'язків, Команда, Посередник і Спостерігач** по-різному поєднують відправників і отримувачів запитів. Ланцюжок обов'язків передає запит по динамічному ланцюгу отримувачів, доки хтось його не обробить. Команда встановлює однонапрямлений зв'язок від відправника до отримувача. Посередник прибирає прямі зв'язки й змушує компоненти спілкуватися через об'єкт-посередник. Спостерігач дає отримувачам змогу динамічно підписуватися на запити й відписуватися від них.
- **Фасад проти Посередника.** Обидва впорядковують роботу з багатьма тісно пов'язаними класами. Фасад надає *простіший інтерфейс* до підсистеми й не додає нової поведінки. Підсистема не знає про існування фасаду, а її об'єкти й далі спілкуються між собою напряму. Посередник *централізує спілкування*: компоненти знають посередника й зовсім не спілкуються напряму.
- **Посередник проти Спостерігача.** Мета Посередника — прибрати взаємні залежності між набором компонентів, які натомість залежать від одного об'єкта-посередника. Мета Спостерігача — налаштувати динамічні однонапрямлені зв'язки, у яких одні об'єкти стежать за іншими. Популярна реалізація Посередника спирається на Спостерігача: посередник стає видавцем, а компоненти підписуються на його події (як у шині подій вище). Тоді патерни дуже схожі. Проте всі компоненти можна й назавжди прив'язати до одного посередника без жодних підписок (як у діалозі вище), і це все одно буде Посередник. А в програмі, де кожен компонент є видавцем, центрального посередника немає зовсім — лише розподілений набір спостерігачів.
- **Посередник і Фабрика/Фасад.** Посередник, що створює й знищує свої компоненти, бере на себе частину роботи фабрики, а ззовні може виглядати як фасад.

## Типові помилки

- **Компонент, не прив'язаний до посередника.** Якщо посередника приєднують уже після створення компонента (як у концептуальному прикладі), про це легко забути, і перша ж подія завершується помилкою далеко від справжньої причини:

  ```python
  class Button:
      def __init__(self, mediator=None) -> None:
          self.mediator = mediator

      def click(self) -> None:
          self.mediator.notify(self, "click")


  button = Button()  # ніхто не прив'язав її до діалогу
  try:
      button.click()
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Результат:

  ```text
  AttributeError: 'NoneType' object has no attribute 'notify'
  ```

  Краще передавати посередника в конструктор як обов'язковий аргумент або генерувати зрозумілу помилку, коли його немає (як це робить `User.say()` у прикладі з чатом).

- **Нескінченні цикли сповіщень.** Посередник реагує на подію, змінюючи компонент, компонент повідомляє про зміну, посередник знову реагує, і так далі:

  ```python
  class Field:
      def __init__(self, name: str, mediator: "SyncMediator") -> None:
          self.name = name
          self.mediator = mediator
          self.value = 0

      def set(self, value: int) -> None:
          self.value = value
          self.mediator.notify(self, "changed")


  class SyncMediator:
      """Тримає два поля однаковими. ПОМИЛКА: реагує на зміни, які робить сам."""

      def __init__(self) -> None:
          self.a = Field("a", self)
          self.b = Field("b", self)

      def notify(self, sender: Field, event: str) -> None:
          other = self.b if sender is self.a else self.a
          other.set(sender.value)  # це знову викликає notify(), і знову...


  m = SyncMediator()
  try:
      m.a.set(5)
  except RecursionError:
      print("RecursionError")
  ```

  Результат:

  ```text
  RecursionError
  ```

  Розірвіть цикл: сповіщайте лише про **справжні** зміни або дайте компонентам спосіб змінювати стан без сповіщення (наприклад, метод `set_silently()` чи прапорець `notify=False`). Тут досить першого варіанта: додайте `if value == self.value: return` на початок `Field.set()`. Тоді другий виклик від посередника побачить, що значення вже однакове, і зупиниться, а `m.a.set(5)` залишить в обох полях `5`.

- **Одруківки в рядкових назвах подій.** `notify(self, "clik")` не збігається з жодним правилом, і нічого не відбувається: ні помилки, ні попередження. Використовуйте для назв подій `Enum` (`StrEnum`, починаючи з Python 3.11) і нехай посередник відхиляє невідомі події:

  ```python
  from enum import StrEnum


  class Event(StrEnum):
      CLICK = "click"
      CHECK = "check"


  class Dialog:
      def notify(self, sender: object, event: Event) -> None:
          match event:
              case Event.CLICK:
                  print("submitting the form")
              case Event.CHECK:
                  print("switching the mode")
              case _:
                  raise ValueError(f"unknown event {event!r} from {sender!r}")


  dialog = Dialog()
  dialog.notify("ok-button", Event.CLICK)
  try:
      dialog.notify("ok-button", "clik")  # одруківка більше не зникає непомітно
  except ValueError as exc:
      print("ValueError:", exc)
  try:
      Event.CLIK
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Результат:

  ```text
  submitting the form
  ValueError: unknown event 'clik' from 'ok-button'
  AttributeError: type object 'Event' has no attribute 'CLIK'
  ```

- **Посередник — «божественний об'єкт».** Посередник має *координувати*, а не виконувати роботу компонентів. Якщо він перевіряє e-mail, форматує ціни й звертається до бази даних, поверніть цю логіку в компоненти чи сервіси, а в посереднику залиште лише «коли стається X, попроси Y зробити Z». Коли посередник стає величезним, розділіть його: один посередник на діалог чи сценарій використання, а не один на весь застосунок.
- **Компоненти, які все ще спілкуються напряму.** Якщо кнопка зберігає один «маленький» прямий виклик текстового поля, зв'язаність повертається, а посередник більше не описує всіх взаємодій. Кожна взаємодія між компонентами має йти через посередника.
- **Компоненти, що залежать від конкретного посередника.** Кнопка, яка викликає `self.dialog.validate_profile()`, працює лише всередині діалогу профілю. Компоненти мають користуватися тільки інтерфейсом посередника (`notify()`), інакше повторно використати їх не вийде.

## Підсумок

- Посередник замінює павутину прямих зв'язків між об'єктами на зірку: компоненти говорять лише з посередником, а він вирішує, хто відреагує.
- Компоненти тримають посилання, оголошене через інтерфейс посередника, зазвичай з одним методом `notify(sender, event)`. Вони не знають ні одне одного, ні конкретного посередника.
- Конкретний посередник містить правила співпраці й часто створює свої компоненти та володіє ними, як діалог володіє своїми віджетами.
- Нові посередники дають тим самим компонентам нові способи співпраці (принцип відкритості/закритості) і роблять компоненти придатними для повторного використання.
- Посередника можна побудувати на Спостерігачі (шина подій), але посередник без жодних підписок — це все одно посередник. Фасад, на відміну від Посередника, лише спрощує доступ і не чіпає внутрішніх зв'язків підсистеми.
- Стежте за неприв'язаними компонентами, циклами сповіщень і одруківками в назвах подій, і не давайте посередникові розростися в «божественний об'єкт».

## Практика

### Вправа 1: Диспетчерська вежа

Змоделюйте аеропорт з однією злітно-посадковою смугою. Напишіть компонент `Plane(callsign, tower)` з методами `request_landing()`, `vacate_runway()` і `receive(message)` та посередника `Tower`. Якщо смуга вільна, вежа дозволяє літаку посадку. Якщо зайнята, вежа наказує літаку чекати, ставить його в чергу й повідомляє його номер. Коли літак звільняє смугу, вежа дозволяє посадку наступному літаку з черги. Літак, якого немає на смузі, не повинен мати змоги її «звільнити». Літаки не мають знати одне про одного.

### Вправа 2: Розплутайте форму профілю

Перепишіть код із розділу «Проблема» з посередником. Створіть універсальні компоненти `TextField`, `Checkbox` (з методом `toggle()`) і `Button` (з методом `click()`), які знають лише протокол `Mediator`, та посередника `ProfileDialog` з полями «name» і «dog name», прапорцем «I have a dog» і кнопкою «Submit». Позначення прапорця показує поле клички, зняття позначки ховає поле **й очищає його значення**. Кнопка Submit виводить список порожніх видимих полів або повідомляє про збереження. Потім доведіть, що компоненти придатні для повторного використання: побудуйте другого посередника, `NewsletterDialog`, із прапорцем і кнопкою, яка виводить, чи підписався користувач, на тих самих класах компонентів і не змінюючи їх.

### Вправа 3: Модерована кімната

Використовуючи без змін клас `User` із прикладу з чатом, напишіть нового посередника `ModeratedRoom(banned, max_strikes=2)`. Він розсилає повідомлення всім, крім автора, але замінює заборонені слова на `***` (без урахування регістру й розділових знаків у кінці слова, як-от `!` чи `?`). Кожне повідомлення із забороненим словом — це штрафний бал: за перші бали автор отримує попередження, а коли їх набирається `max_strikes`, авторові забороняють писати, і про це дізнаються всі в кімнаті. Користувач, якому заборонено писати, отримує відповідь «you are muted», а його повідомлення не доставляються.

## Розв'язки

### Вправа 1

```python
from collections import deque
from typing import Protocol


class ControlTower(Protocol):
    def notify(self, sender: "Plane", event: str) -> None: ...


class Plane:
    def __init__(self, callsign: str, tower: ControlTower) -> None:
        self.callsign = callsign
        self.tower = tower

    def request_landing(self) -> None:
        print(f"{self.callsign}: requesting landing")
        self.tower.notify(self, "landing_request")

    def vacate_runway(self) -> None:
        print(f"{self.callsign}: runway vacated")
        self.tower.notify(self, "runway_vacated")

    def receive(self, message: str) -> None:
        print(f"  tower -> {self.callsign}: {message}")


class Tower:
    """Посередник: єдиний об'єкт, що знає про смугу й чергу."""

    def __init__(self) -> None:
        self.on_runway: Plane | None = None
        self.waiting: deque[Plane] = deque()

    def notify(self, sender: Plane, event: str) -> None:
        match event:
            case "landing_request":
                if self.on_runway is None:
                    self._clear(sender)
                else:
                    self.waiting.append(sender)
                    sender.receive(f"hold, you are number {len(self.waiting)}")
            case "runway_vacated" if sender is self.on_runway:
                self.on_runway = None
                if self.waiting:
                    self._clear(self.waiting.popleft())
            case _:
                raise ValueError(f"unexpected {event!r} from {sender.callsign}")

    def _clear(self, plane: Plane) -> None:
        self.on_runway = plane
        plane.receive("cleared to land")


tower = Tower()
ps101, lo282, w61001 = (Plane(c, tower) for c in ("PS101", "LO282", "W61001"))

ps101.request_landing()
lo282.request_landing()
w61001.request_landing()
ps101.vacate_runway()
lo282.vacate_runway()

try:
    ps101.vacate_runway()  # PS101 уже не на смузі
except ValueError as exc:
    print("ValueError:", exc)
```

Результат:

```text
PS101: requesting landing
  tower -> PS101: cleared to land
LO282: requesting landing
  tower -> LO282: hold, you are number 1
W61001: requesting landing
  tower -> W61001: hold, you are number 2
PS101: runway vacated
  tower -> LO282: cleared to land
LO282: runway vacated
  tower -> W61001: cleared to land
PS101: runway vacated
ValueError: unexpected 'runway_vacated' from PS101
```

Черга й стан смуги існують лише в `Tower`. Літак тільки повідомляє про події й отримує вказівки. Умова `case "runway_vacated" if sender is self.on_runway` змушує вежу відхиляти повідомлення, що не відповідає її стану, тож літак, який заплутався, не звільнить смугу за когось іншого.

### Вправа 2

```python
from typing import Protocol


class Mediator(Protocol):
    def notify(self, sender: object, event: str) -> None: ...


# Універсальні компоненти: жоден не знає про інші.
class TextField:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog
        self.value = ""
        self.visible = True


class Checkbox:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog
        self.checked = False

    def toggle(self) -> None:
        self.checked = not self.checked
        self.dialog.notify(self, "toggle")


class Button:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog

    def click(self) -> None:
        self.dialog.notify(self, "click")


class ProfileDialog:
    def __init__(self) -> None:
        self.name = TextField("name", self)
        self.dog_name = TextField("dog name", self)
        self.dog_name.visible = False
        self.has_dog = Checkbox("I have a dog", self)
        self.submit = Button("Submit", self)

    def notify(self, sender: object, event: str) -> None:
        if sender is self.has_dog and event == "toggle":
            self.dog_name.visible = self.has_dog.checked
            if not self.dog_name.visible:
                self.dog_name.value = ""  # приховане поле не тримає старих даних
        elif sender is self.submit and event == "click":
            fields = (self.name, self.dog_name)
            missing = [f.label for f in fields if f.visible and not f.value]
            print("missing:", missing if missing else "nothing, saving")


class NewsletterDialog:
    """Інша форма, що повторно використовує ті самі класи Checkbox і Button."""

    def __init__(self) -> None:
        self.subscribe = Checkbox("Send me news", self)
        self.send = Button("Send", self)

    def notify(self, sender: object, event: str) -> None:
        if sender is self.send:
            print("subscribed" if self.subscribe.checked else "not subscribed")


profile = ProfileDialog()
profile.name.value = "Olena"
profile.submit.click()
profile.has_dog.toggle()
profile.submit.click()
profile.dog_name.value = "Rex"
profile.submit.click()

newsletter = NewsletterDialog()
newsletter.send.click()
newsletter.subscribe.toggle()
newsletter.send.click()
```

Результат:

```text
missing: nothing, saving
missing: ['dog name']
missing: nothing, saving
not subscribed
subscribed
```

`Checkbox` і `Button` використовують два різні діалоги з цілком різними правилами, а класи компонентів при цьому не змінювалися. Саме такого повторного використання не допускала зв'язана версія. Очищення клички собаки, коли поле ховається, — правило цієї форми, тому воно живе в посереднику, а не в `Checkbox` чи `TextField`.

### Вправа 3

```python
from typing import Protocol


class Room(Protocol):
    def send(self, sender: "User", text: str) -> None: ...


class User:
    """Точнісінько той самий компонент, що й у прикладі з ChatRoom."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.room: Room | None = None

    def say(self, text: str) -> None:
        if self.room is None:
            raise RuntimeError(f"{self.name} has not joined a room")
        self.room.send(self, text)

    def receive(self, author: str, text: str) -> None:
        print(f"  {self.name:<6} <- {author}: {text}")


class ModeratedRoom:
    """Новий посередник: нові правила взаємодії, User не змінюється."""

    def __init__(self, banned: set[str], max_strikes: int = 2) -> None:
        self.banned = {word.lower() for word in banned}
        self.max_strikes = max_strikes
        self._members: dict[str, User] = {}
        self._strikes: dict[str, int] = {}
        self._muted: set[str] = set()

    def join(self, user: User) -> None:
        self._members[user.name] = user
        user.room = self

    def send(self, sender: User, text: str) -> None:
        if sender.name in self._muted:
            sender.receive("moderator", "you are muted")
            return
        words = text.split()
        clean = " ".join(
            "***" if w.strip(".,!?").lower() in self.banned else w for w in words
        )
        if clean != " ".join(words):
            self._strike(sender)
        if sender.name not in self._muted:
            self._broadcast(sender.name, clean, skip=sender.name)

    def _strike(self, user: User) -> None:
        self._strikes[user.name] = self._strikes.get(user.name, 0) + 1
        if self._strikes[user.name] >= self.max_strikes:
            self._muted.add(user.name)
            self._broadcast("moderator", f"{user.name} is muted")
        else:
            user.receive("moderator", "warning: watch your language")

    def _broadcast(self, author: str, text: str, skip: str = "") -> None:
        for name, member in self._members.items():
            if name != skip:
                member.receive(author, text)


room = ModeratedRoom(banned={"darn", "heck"})
olena, max_ = User("olena"), User("max")
room.join(olena)
room.join(max_)

max_.say("hello there")
max_.say("what the Heck!")
max_.say("darn it")
max_.say("sorry")
```

Результат:

```text
  olena  <- max: hello there
  max    <- moderator: warning: watch your language
  olena  <- max: what the ***
  olena  <- moderator: max is muted
  max    <- moderator: max is muted
  max    <- moderator: you are muted
```

`User` — той самий клас, що й у практичному прикладі, і йому байдуже, у `ChatRoom` він чи в `ModeratedRoom`: він лише викликає `room.send()`. Уся політика модерації (список слів, штрафні бали, заборона писати, оголошення) — це новий посередник. Повідомлення, через яке авторові заборонили писати, не доставляється взагалі, бо після нарахування бала кімната ще раз перевіряє множину тих, кому заборонено писати.

---

*Джерела: [Refactoring.Guru — Посередник](https://refactoring.guru/design-patterns/mediator), [Refactoring.Guru — Посередник на Python](https://refactoring.guru/design-patterns/mediator/python/example). Адаптовано й доповнено для PyJourney.*
