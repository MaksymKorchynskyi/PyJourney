# Фабричний метод

**Фабричний метод** (Factory Method) — це породжувальний патерн проєктування. Базовий клас визначає, *коли* і *навіщо* потрібен об'єкт, а рішення про те, *який саме клас* створити, залишає підкласам. Це найпростіший спосіб не «приварювати» бізнес-логіку до конкретних класів, і трапляється він усюди: від GUI-фреймворків до вбудованого в Python методу `__iter__`.

## Що ви дізнаєтесь

- Яку проблему розв'язує Фабричний метод і як розпізнати її в реальному коді
- Чотири ролі патерна: Творець, Конкретний творець, Продукт і Конкретний продукт
- Як ідіоматично реалізувати патерн на Python за допомогою `abc.ABC` та анотацій типів
- Легші пайтонівські варіанти: атрибут класу або переданий callable замість підкласу
- Коли патерн себе виправдовує, коли він зайвий і як він пов'язаний з іншими патернами
- Класичну пастку: виклик фабричного методу з `__init__`

## Суть патерна

Фабричний метод оголошує в базовому класі метод, який повертає нові об'єкти, і дає підкласам змогу перевизначити цей метод, щоб змінити клас створюваних об'єктів. Решта коду базового класу працює лише з абстрактним результатом, тож їй не потрібно знати, який конкретний клас вона отримала. Патерн також називають **Віртуальним конструктором**: «виклик конструктора» диспетчеризується поліморфно, як і будь-який інший метод.

## Проблема

Уявіть першу версію застосунку для логістики. Він підтримує лише автоперевезення, тому більша частина коду працює безпосередньо з класом `Truck`:

```python
class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo} by road"


class Logistics:
    def plan_delivery(self, cargo: str) -> str:
        transport = Truck()  # жорстко зашитий конкретний клас
        return transport.deliver(cargo)


print(Logistics().plan_delivery("10 t of coffee"))
```

Результат:

```text
Truck delivers 10 t of coffee by road
```

Застосунок стає популярним, і морські перевізники просять додати підтримку суден. Написати клас `Ship` нескладно. Складно з усім кодом, який напряму викликає `Truck()`. Звичне «швидке рішення» — параметр і умова:

```python
class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo} by road"


class Ship:
    def deliver(self, cargo: str) -> str:
        return f"Ship delivers {cargo} by sea"


class Logistics:
    def plan_delivery(self, cargo: str, kind: str) -> str:
        if kind == "road":
            transport = Truck()
        elif kind == "sea":
            transport = Ship()
        else:
            raise ValueError(f"unknown transport: {kind}")
        return transport.deliver(cargo)


print(Logistics().plan_delivery("10 t of coffee", "sea"))
```

Результат:

```text
Ship delivers 10 t of coffee by sea
```

Це працює, але погано масштабується. Кожен новий вид транспорту (літаки, потяги, дрони) означає чергову правку `plan_delivery`, а той самий ланцюжок `if/elif` зазвичай розповзається по всіх методах, що створюють транспорт. Клас, який мав лише планувати доставку, тепер змушений знати про всі наявні види транспорту.

## Рішення

Фабричний метод пропонує винести створення об'єктів в окремий метод — **фабричний метод** — і викликати його замість прямого виклику конструктора. Об'єкти, які він повертає, називають **продуктами**.

На перший погляд ми лише перенесли один рядок коду. Користь у тому, що це відкриває: підклас може **перевизначити** фабричний метод і повертати інший продукт. Базовий клас зберігає всю спільну логіку, а кожен підклас змінює лише одне рішення.

Є одна умова. Усі продукти повинні мати спільний інтерфейс (базовий клас або протокол), а код базового класу має працювати з продуктами лише через цей інтерфейс. І `Truck`, і `Ship` мають метод `deliver()`. Кожен реалізує його по-своєму, але `plan_delivery()` байдуже, який саме об'єкт прийшов.

## Аналогія з життя

Уявіть мережу кав'ярень. Головний офіс пише один регламент обслуговування для всіх закладів: прийняти замовлення, приготувати напій, накрити кришкою, віддати, прийняти оплату. Один крок — «приготувати напій» — кожна кав'ярня виконує по-своєму. У Римі каву варять в еспресо-машині, у Стамбулі — у джезві. Відвідувачі всюди проходять той самий сценарій. Відрізняється лише крок, який «виготовляє» напій, і головному офісу не доводиться переписувати регламент, коли відкривається заклад нового типу.

## Структура

```text
+-------------------------------+            +---------------------------+
|           Creator             |  creates   |       <<interface>>       |
|-------------------------------|----------->|          Product          |
| + some_operation()            |            |---------------------------|
| + factory_method(): Product   |            | + operation()             |
|          {abstract}           |            +---------------------------+
+-------------------------------+                 ^                 ^
          ^               ^                       |  implements     |
          |  inherits     |                       |                 |
+------------------+ +------------------+ +------------------+ +------------------+
| ConcreteCreatorA | | ConcreteCreatorB | | ConcreteProductA | | ConcreteProductB |
|------------------| |------------------| |------------------| |------------------|
| factory_method() | | factory_method() | | operation()      | | operation()      |
|  -> ProductA()   | |  -> ProductB()   | +------------------+ +------------------+
+------------------+ +------------------+

some_operation():
    product = self.factory_method()   # який клас? вирішує підклас
    return product.operation()        # використовується лише через інтерфейс Product
```

1. **Продукт** (Product) оголошує інтерфейс, спільний для всього, що може створити творець.
2. **Конкретні продукти** (Concrete Products) — різні реалізації цього інтерфейсу.
3. **Творець** (Creator) оголошує фабричний метод, тип результату якого — інтерфейс *продукту*. Метод може бути абстрактним (тоді кожен підклас зобов'язаний його перевизначити) або повертати розумний продукт за замовчуванням. Попри назву, створення продуктів зазвичай **не** є головним обов'язком творця. Він містить справжню бізнес-логіку (`some_operation`), якій просто потрібен продукт.
4. **Конкретні творці** (Concrete Creators) перевизначають фабричний метод, щоб повертати певний продукт. Метод не мусить щоразу створювати новий об'єкт: він може взяти його з кешу чи пулу.

## Реалізація на Python

Ось застосунок для логістики, перебудований за патерном. `Transport` — продукт, `Logistics` — творець, а кожен підклас `Logistics` обирає свій транспорт.

```python
from abc import ABC, abstractmethod


class Transport(ABC):
    """Продукт: інтерфейс, якого дотримується кожен вид транспорту."""

    @abstractmethod
    def deliver(self, cargo: str, distance_km: int) -> str: ...


class Truck(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Truck drives {cargo} {distance_km} km by road ({distance_km / 80:.1f} h)"


class Ship(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Ship carries {cargo} {distance_km} km by sea ({distance_km / 30:.1f} h)"


class Logistics(ABC):
    """Творець: містить бізнес-логіку та оголошує фабричний метод."""

    @abstractmethod
    def create_transport(self) -> Transport:
        """Фабричний метод: підкласи вирішують, який Transport створити."""

    def plan_delivery(self, cargo: str, distance_km: int) -> str:
        transport = self.create_transport()  # тут не згадано жодного конкретного класу
        report = transport.deliver(cargo, distance_km)
        return f"[{type(self).__name__}] {report}"


class RoadLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Truck()


class SeaLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Ship()


def run_company(logistics: Logistics) -> None:
    # Клієнт знає лише інтерфейс Logistics.
    print(logistics.plan_delivery("10 t of coffee", 1200))


run_company(RoadLogistics())
run_company(SeaLogistics())
```

Результат:

```text
[RoadLogistics] Truck drives 10 t of coffee 1200 km by road (15.0 h)
[SeaLogistics] Ship carries 10 t of coffee 1200 km by sea (40.0 h)
```

`plan_delivery()` написано один раз, і він працює з будь-яким транспортом. Фабричний метод `create_transport()` повертає абстрактний `Transport`, тож ні творець, ні клієнт не залежать від `Truck` чи `Ship`.

Щоб додати авіаперевезення, достатньо написати нові класи, нічого не змінюючи в наявних:

```python
# Продовження попереднього прикладу
class Plane(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Plane flies {cargo} {distance_km} km by air ({distance_km / 800:.1f} h)"


class AirLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Plane()


run_company(AirLogistics())
```

Результат:

```text
[AirLogistics] Plane flies 10 t of coffee 1200 km by air (1.5 h)
```

Оскільки `Logistics` використовує `@abstractmethod`, випадково створити його екземпляр не вийде. Python зупинить вас уже під час створення об'єкта, а не згодом, із заплутаною помилкою через продукт `None`:

```python
# Продовження попереднього прикладу
try:
    Logistics()
except TypeError as error:
    print(error)
```

Результат:

```text
Can't instantiate abstract class Logistics without an implementation for abstract method 'create_transport'
```

> **Порада:** починаючи з Python 3.12, методи, що перевизначають батьківські, можна позначати декоратором `@typing.override`. Під час виконання він нічого не робить, але перевіряльник типів помітить одруківку на кшталт `create_transprot`, яка інакше непомітно додала б новий метод замість перевизначення фабричного.

### Пайтонівські варіанти

У Python класи — звичайні об'єкти, тому підклас для кожного продукту потрібен не завжди. Поширені дві легші форми:

```python
from collections.abc import Callable
from typing import Protocol


class Transport(Protocol):
    def deliver(self, cargo: str) -> str: ...


class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo}"


class Drone:
    def deliver(self, cargo: str) -> str:
        return f"Drone delivers {cargo}"


# Варіант 1: «фабричний метод» — це атрибут класу, що зберігає клас.
class Logistics:
    transport_class: type[Transport] = Truck

    def plan_delivery(self, cargo: str) -> str:
        return self.transport_class().deliver(cargo)


class DroneLogistics(Logistics):
    transport_class = Drone


# Варіант 2: передаємо будь-який callable без аргументів, що створює продукт.
class Dispatcher:
    def __init__(self, make_transport: Callable[[], Transport] = Truck) -> None:
        self._make_transport = make_transport

    def dispatch(self, cargo: str) -> str:
        return self._make_transport().deliver(cargo)


print(Logistics().plan_delivery("letters"))
print(DroneLogistics().plan_delivery("pizza"))
print(Dispatcher().dispatch("furniture"))
print(Dispatcher(Drone).dispatch("medicine"))
```

Результат:

```text
Truck delivers letters
Drone delivers pizza
Truck delivers furniture
Drone delivers medicine
```

- **Варіант 1** — це досі Фабричний метод: підкласи змінюють продукт, перевизначаючи один атрибут класу замість цілого методу. Підходить, коли створення продукту не потребує додаткової логіки.
- **Варіант 2** замінює успадкування композицією (впровадження залежностей, dependency injection). Часто це найбільш пайтонівський вибір, коли змінюється *лише* продукт. Повний патерн варто обирати, коли підкласи налаштовують і іншу поведінку або коли ви проєктуєте точки розширення фреймворку.

> **Зверніть увагу:** альтернативні конструктори, як-от `dict.fromkeys()`, `int.from_bytes()` чи `datetime.fromisoformat()`, теж часто називають «фабричними методами». Це іменовані конструктори-`@classmethod`, що створюють екземпляр *того самого класу* з інших вхідних даних. Ідіома корисна, але це не Фабричний метод із книжки GoF, суть якого — дати підкласам змогу обрати *інший клас продукту*.

## Практичний приклад: експорт звітів

Модуль звітів перевіряє дані, формує назву файлу й додає заголовок. Між CSV та JSON відрізняється лише форматування. Творець зберігає спільну логіку, а фабричний метод постачає форматувальник.

```python
import csv
import io
import json
from abc import ABC, abstractmethod

type Row = dict[str, str | int | float]


class Formatter(ABC):
    """Продукт."""

    @abstractmethod
    def render(self, rows: list[Row]) -> str: ...


class CsvFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue().rstrip("\n")


class JsonFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        return json.dumps(rows, ensure_ascii=False)


class ReportExporter(ABC):
    """Творець: перевірка, назва файлу й заголовок живуть тут, в одному місці."""

    extension = "txt"

    def export(self, title: str, rows: list[Row]) -> str:
        if not rows:
            raise ValueError("nothing to export")
        formatter = self.create_formatter()
        filename = f"{title.lower().replace(' ', '_')}.{self.extension}"
        return f"# {filename} ({len(rows)} rows)\n{formatter.render(rows)}"

    @abstractmethod
    def create_formatter(self) -> Formatter: ...


class CsvExporter(ReportExporter):
    extension = "csv"

    def create_formatter(self) -> Formatter:
        return CsvFormatter()


class JsonExporter(ReportExporter):
    extension = "json"

    def create_formatter(self) -> Formatter:
        return JsonFormatter()


# Застосунок обирає конкретного творця з конфігурації.
EXPORTERS: dict[str, type[ReportExporter]] = {"csv": CsvExporter, "json": JsonExporter}


def export_report(fmt: str, title: str, rows: list[Row]) -> str:
    try:
        exporter_class = EXPORTERS[fmt]
    except KeyError:
        raise ValueError(f"unknown format {fmt!r}, choose from {sorted(EXPORTERS)}") from None
    return exporter_class().export(title, rows)


sales: list[Row] = [
    {"city": "Kyiv", "orders": 120, "revenue": 5400.5},
    {"city": "Lviv", "orders": 75, "revenue": 3100.0},
]

print(export_report("csv", "Sales Q3", sales))
print()
print(export_report("json", "Sales Q3", sales))
print()
try:
    export_report("xml", "Sales Q3", sales)
except ValueError as error:
    print("Error:", error)
```

Результат:

```text
# sales_q3.csv (2 rows)
city,orders,revenue
Kyiv,120,5400.5
Lviv,75,3100.0

# sales_q3.json (2 rows)
[{"city": "Kyiv", "orders": 120, "revenue": 5400.5}, {"city": "Lviv", "orders": 75, "revenue": 3100.0}]

Error: unknown format 'xml', choose from ['csv', 'json']
```

Інструкція `type Row = ...` оголошує псевдонім типу (Python 3.12+). У старіших версіях пишіть `Row = dict[str, str | int | float]`.

Тепер уявіть, що `ReportExporter` належить бібліотеці, яку ви не можете змінювати. Користувач, якому потрібен вивід у Markdown, розширює її ззовні, і всі правила з `export()` (перевірка, назва файлу, заголовок) працюють і далі:

```python
# Продовження попереднього прикладу
class MarkdownFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        headers = list(rows[0])
        lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
        for row in rows:
            lines.append("| " + " | ".join(str(row[h]) for h in headers) + " |")
        return "\n".join(lines)


class MarkdownExporter(ReportExporter):
    extension = "md"

    def create_formatter(self) -> Formatter:
        return MarkdownFormatter()


EXPORTERS["md"] = MarkdownExporter
print(export_report("md", "Sales Q3", sales))
```

Результат:

```text
# sales_q3.md (2 rows)
| city | orders | revenue |
|---|---|---|
| Kyiv | 120 | 5400.5 |
| Lviv | 75 | 3100.0 |
```

Саме так багато фреймворків відкривають точки розширення: фреймворк викликає фабричний метод, а ви перевизначаєте його, щоб підключити власний компонент.

## Коли застосовувати

- **Ви заздалегідь не знаєте, з якими саме класами працюватиме код**, або очікуєте, що їх стане більше. Код створення відокремлено від коду, що використовує продукт, тому нові продукти додаються без змін у наявній логіці.
- **Ви пишете бібліотеку чи фреймворк і хочете, щоб користувачі могли замінювати внутрішні компоненти.** Самого підкласу компонента замало: фреймворк має якось дізнатися, що треба *використовувати* саме його. Фабричний метод і є таким гачком. UI-фреймворк, що створює кнопки через `create_button()`, дає користувачеві змогу повернути `RoundButton` замість стандартної квадратної кнопки.
- **Ви хочете повторно використовувати наявні об'єкти замість створення нових**, наприклад з'єднання з базою даних чи інші дорогі ресурси. `__init__` завжди ініціалізує щойно створений об'єкт, тому віддати вже наявний він не може. Звичайний метод може: спершу пошукати в кеші чи пулі, а новий об'єкт створити лише за потреби. (Формально `__new__` теж здатен повернути закешований екземпляр, але це дивує читачів коду, а `__init__` потім знову спрацює на повторно використаному об'єкті.)

## Кроки реалізації

1. Приведіть усі продукти до спільного інтерфейсу: `ABC` з абстрактними методами або `typing.Protocol`, якщо вам ближча структурна типізація. Додавайте лише методи, що мають сенс для кожного продукту.
2. Додайте до класу-творця фабричний метод. Укажіть інтерфейс продукту як тип його результату.
3. Знайдіть у творці всі місця, де безпосередньо викликаються конструктори продуктів. Замініть кожен виклик на `self.factory_method()`, а код створення перенесіть у фабричний метод.
4. Для кожного типу продукту створіть підклас конкретного творця й перевизначте в ньому фабричний метод.
5. Якщо варіантів продукту багато й окремий підклас для кожного був би надмірним, дозвольте фабричному методу приймати параметр, що обирає продукт усередині одного підкласу.
6. Якщо після всього цього базовий фабричний метод порожній, зробіть його абстрактним за допомогою `@abstractmethod`. Якщо в ньому щось лишилося, нехай це буде поведінка за замовчуванням.

## Переваги та недоліки

| Переваги | Недоліки |
|---|---|
| Творець не прив'язаний жорстко до конкретних класів продуктів. | Може знадобитися багато нових підкласів: по творцю на продукт. |
| *Принцип єдиного обов'язку*: створення продуктів зосереджено в одному місці. | Патерн зайвий, коли змінюється лише продукт: передати клас чи callable простіше. |
| *Принцип відкритості/закритості*: нові продукти додаються без змін у наявному клієнтському коді. | Щоб побачити, що насправді створюється, читачеві доводиться пройти зайвий рівень непрямості. |
| Природна точка розширення для бібліотек і фреймворків. | Найкраще працює, коли вже є ієрархія творців, на яку його можна «почепити». |

## Зв'язки з іншими патернами

- Багато архітектур починаються з **Фабричного методу** (простого, налаштовуваного через підкласи) і згодом переходять до **Абстрактної фабрики**, **Прототипу** чи **Будівельника** (гнучкіших, але складніших).
- Класи **Абстрактної фабрики** часто будують із набору фабричних методів, по одному на продукт.
- **Ітератор**: фабричний метод колекції може повертати ітератор, що відповідає цій колекції. Метод `__iter__` у Python — саме такий випадок: кожен ітерований об'єкт сам вирішує, ітератор якого класу повернути.
- **Прототип** створює об'єкти клонуванням і не спирається на успадкування, але вимагає ініціалізації клона. Фабричний метод спирається на успадкування й такого кроку не потребує.
- Фабричний метод — окремий випадок **Шаблонного методу**: `plan_delivery()` вище — маленький шаблон, єдиний змінний крок якого і є фабричним методом. Водночас фабричний метод часто буває одним із кроків більшого шаблонного методу.

## Типові помилки

- **Виклик фабричного методу з базового `__init__`.** Перевизначений метод підкласу спрацьовує *раніше*, ніж підклас завершить власну ініціалізацію:

  ```python
  class Exporter:
      def __init__(self) -> None:
          self.formatter = self.create_formatter()  # викликано зарано

      def create_formatter(self) -> str:
          return "plain"


  class PrettyExporter(Exporter):
      def __init__(self, indent: int) -> None:
          super().__init__()
          self.indent = indent

      def create_formatter(self) -> str:
          return f"pretty(indent={self.indent})"  # self.indent ще не існує


  try:
      PrettyExporter(indent=4)
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Результат:

  ```text
  AttributeError: 'PrettyExporter' object has no attribute 'indent'
  ```

  Викликайте фабричний метод ліниво, тоді, коли продукт справді потрібен (як це робить `plan_delivery()`), або встановлюйте атрибути підкласу *до* виклику `super().__init__()`.

- **Називати «фабричним методом» великий `if/elif`.** Одна функція, що обирає клас за рядком, — це *проста фабрика*. Як перший крок вона цілком годиться, але кожен новий продукт однаково вимагає її правки. Сила патерна — у перевизначенні.
- **Витік конкретних типів.** Якщо базовий клас чи клієнт анотує продукт як `Truck` або викликає методи, що є лише у вантажівки, заміна на `Ship` усе зламає. Програмуйте на рівні інтерфейсу продукту.
- **Ієрархія творців, яка нікому не потрібна.** Якщо підкласи відрізняються лише класом продукту, атрибут класу або переданий callable (див. *Пайтонівські варіанти*) зроблять те саме з меншим обсягом коду.
- **Забутий `@abstractmethod`.** Без нього базового творця можна створити, його фабричний метод мовчки поверне `None`, а помилка виникне далеко звідти: `'NoneType' object has no attribute 'deliver'`.

## Підсумок

- Фабричний метод замінює прямі виклики конструкторів викликом методу, який можна перевизначити і який повертає продукт.
- Творець містить справжню бізнес-логіку й працює з продуктами лише через їхній спільний інтерфейс.
- Підкласи змінюють те, *що* створюється; базовий клас вирішує, *коли* і *як* це використовується.
- У Python описуйте продукт через `ABC` або `Protocol`, а фабричний метод позначайте `@abstractmethod`, якщо розумного варіанта за замовчуванням немає.
- Якщо змінюється лише продукт, атрибут класу чи переданий callable часто будуть більш пайтонівським рішенням.
- Фабричний метод може повертати об'єкти з кешу чи пулу, чого конструктор охайно зробити не може.
- Не викликайте фабричний метод із базового `__init__`, якщо підкласи залежать від власного стану.

## Практика

### Вправа 1: Канали сповіщень

Створіть інтерфейс продукту `Channel` з методом `send(to: str, text: str) -> str`.

- `EmailChannel.send()` повертає `"EMAIL to <to>: <text>"`.
- `SmsChannel.send()` повертає `"SMS to <to>: <text>"`, але якщо текст довший за 20 символів, залишає перші 17 символів і додає `"..."`.

Потім напишіть творця `Notifier` з абстрактним фабричним методом `create_channel()` і методом `notify(users: list[str], text: str) -> list[str]`, який створює **один** канал і надсилає текст кожному користувачеві. Додайте `EmailNotifier` і `SmsNotifier` та виведіть результати для двох користувачів.

### Вправа 2: Продукт за замовчуванням і розширення фреймворку

У UI-«фреймворку» є клас `Dialog`, метод `render()` якого створює кнопку через `create_button()` і повертає `f"Dialog [{button.draw()}]"`. За замовчуванням `create_button()` повертає `SquareButton`, чий `draw()` повертає `"[ OK ]"`.

Не змінюючи `Dialog`, додайте `RoundButton` (`draw()` повертає `"( OK )"`) і `RoundDialog`, що її використовує. Виведіть результат обох діалогів.

### Вправа 3: Фабричний метод, що повторно використовує об'єкти

Почніть із цього коду:

```python
class Connection:
    opened = 0

    def __init__(self, dsn: str) -> None:
        Connection.opened += 1
        self.dsn = dsn
        self.number = Connection.opened


class Database:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def create_connection(self) -> Connection:
        return Connection(self.dsn)

    def query(self, sql: str) -> str:
        connection = self.create_connection()
        return f"{sql} -> connection #{connection.number}"
```

Кожен виклик `query()` відкриває нове з'єднання. Напишіть підклас `PooledDatabase`, який перевизначає **лише** `create_connection()` так, щоб усі об'єкти `PooledDatabase` з однаковим DSN спільно використовували одне з'єднання. Виконайте три запити через `Database` і три через `PooledDatabase` та після кожної групи виведіть `Connection.opened`.

## Розв'язки

### Вправа 1

```python
from abc import ABC, abstractmethod


class Channel(ABC):
    @abstractmethod
    def send(self, to: str, text: str) -> str: ...


class EmailChannel(Channel):
    def send(self, to: str, text: str) -> str:
        return f"EMAIL to {to}: {text}"


class SmsChannel(Channel):
    LIMIT = 20

    def send(self, to: str, text: str) -> str:
        if len(text) > self.LIMIT:
            text = text[: self.LIMIT - 3] + "..."
        return f"SMS to {to}: {text}"


class Notifier(ABC):
    @abstractmethod
    def create_channel(self) -> Channel: ...

    def notify(self, users: list[str], text: str) -> list[str]:
        channel = self.create_channel()  # один канал на всю розсилку
        return [channel.send(user, text) for user in users]


class EmailNotifier(Notifier):
    def create_channel(self) -> Channel:
        return EmailChannel()


class SmsNotifier(Notifier):
    def create_channel(self) -> Channel:
        return SmsChannel()


users = ["olena", "taras"]
message = "Your order has been shipped"
for notifier in (EmailNotifier(), SmsNotifier()):
    for line in notifier.notify(users, message):
        print(line)
```

Результат:

```text
EMAIL to olena: Your order has been shipped
EMAIL to taras: Your order has been shipped
SMS to olena: Your order has be...
SMS to taras: Your order has be...
```

### Вправа 2

```python
class SquareButton:
    def draw(self) -> str:
        return "[ OK ]"


class Dialog:
    """Клас фреймворку: користувач його не змінює."""

    def create_button(self) -> SquareButton:
        return SquareButton()  # продукт за замовчуванням

    def render(self) -> str:
        button = self.create_button()
        return f"Dialog [{button.draw()}]"


# Код користувача: розширює фреймворк ззовні.
class RoundButton(SquareButton):
    def draw(self) -> str:
        return "( OK )"


class RoundDialog(Dialog):
    def create_button(self) -> SquareButton:
        return RoundButton()


print(Dialog().render())
print(RoundDialog().render())
```

Результат:

```text
Dialog [[ OK ]]
Dialog [( OK )]
```

Тут базовий фабричний метод не абстрактний: він повертає розумний варіант за замовчуванням, а підкласи перевизначають його лише тоді, коли їм потрібне щось інше. `RoundButton` успадковує `SquareButton`, щоб відповідати оголошеному типу результату. У більшому фреймворку для цього оголосили б окремий інтерфейс `Button`.

### Вправа 3

```python
class Connection:
    opened = 0

    def __init__(self, dsn: str) -> None:
        Connection.opened += 1
        self.dsn = dsn
        self.number = Connection.opened


class Database:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def create_connection(self) -> Connection:
        return Connection(self.dsn)

    def query(self, sql: str) -> str:
        connection = self.create_connection()
        return f"{sql} -> connection #{connection.number}"


class PooledDatabase(Database):
    _pool: dict[str, Connection] = {}  # спільний для всіх екземплярів

    def create_connection(self) -> Connection:
        if self.dsn not in self._pool:
            self._pool[self.dsn] = super().create_connection()
        return self._pool[self.dsn]


plain = Database("sqlite:///shop.db")
for sql in ("SELECT 1", "SELECT 2", "SELECT 3"):
    print(plain.query(sql))
print("opened:", Connection.opened)

pooled_a = PooledDatabase("sqlite:///shop.db")
pooled_b = PooledDatabase("sqlite:///shop.db")
for db, sql in ((pooled_a, "SELECT 4"), (pooled_b, "SELECT 5"), (pooled_a, "SELECT 6")):
    print(db.query(sql))
print("opened:", Connection.opened)
print(pooled_a.create_connection() is pooled_b.create_connection())
```

Результат:

```text
SELECT 1 -> connection #1
SELECT 2 -> connection #2
SELECT 3 -> connection #3
opened: 3
SELECT 4 -> connection #4
SELECT 5 -> connection #4
SELECT 6 -> connection #4
opened: 4
True
```

Метод `query()` зовсім не змінився. Лише фабричний метод вирішує, чи створить виклик новий об'єкт, чи поверне наявний. Справжній пул ще обмежував би кількість з'єднань і стежив, які з них вільні, але принцип той самий.

---

*Джерела: [Refactoring.Guru — Фабричний метод](https://refactoring.guru/design-patterns/factory-method), [Refactoring.Guru — Фабричний метод на Python](https://refactoring.guru/design-patterns/factory-method/python/example). Адаптовано й доповнено для PyJourney.*
