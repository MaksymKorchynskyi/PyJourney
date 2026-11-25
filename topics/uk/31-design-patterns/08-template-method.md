# Шаблонний метод

**Шаблонний метод** (Template Method) — поведінковий патерн проєктування, який фіксує *кістяк* алгоритму в базовому класі й дає підкласам заповнювати чи коригувати окремі кроки, не змінюючи їхнього порядку. Це один із найпоширеніших патернів у фреймворках: на ньому побудовані `unittest.TestCase`, `collections.abc` і `threading.Thread`.

## Що ви дізнаєтесь

- Як Шаблонний метод прибирає дубльовані алгоритми з класів-«братів»
- Три види кроків: абстрактні кроки, кроки з типовою реалізацією та хуки
- Як побудувати шаблонний метод за допомогою `abc.ABC` і захистити його через `typing.final`
- Де патерн використовує стандартна бібліотека (`collections.abc.Mapping`, `unittest`)
- Як Шаблонний метод пов'язаний зі Стратегією і коли композиція кращий вибір
- Пастки: виклик кроків з `__init__`, перевизначення кістяка, порушення контракту базового класу

## Суть патерна

Визначте загальну структуру алгоритму в одному методі базового класу (**шаблонному методі**). Шаблонний метод викликає послідовність **кроків**. Підкласи перевизначають деякі кроки, щоб надати власну поведінку, але сама послідовність лишається в базовому класі, і змінити її вони не можуть.

## Проблема

Компанія імпортує дані про продажі від партнерів. Перший партнер надсилав CSV-файли, тож ви написали `CsvImporter`. Потім з'явився другий партнер із JSON, і ви написали `JsonImporter`, скопіювавши перший клас і змінивши частину з розбором. Згодом додався XML.

Усі три класи роблять одне й те саме:

1. розбирають вхідні дані на записи;
2. відкидають некоректні записи (з від'ємною чи нульовою сумою);
3. зберігають записи;
4. виводять підсумок.

Між форматами відрізняється лише крок 1. Кроки 2–4 скопійовані тричі. Коли бізнес вирішив, що нульові суми теж некоректні, хтось виправив перевірку в `CsvImporter` і забув про `JsonImporter`. Тепер два імпортери по-різному обробляють ті самі дані.

Є й друга проблема. Код, що запускає імпортери, переповнений `if isinstance(importer, CsvImporter): ... elif ...`, бо класи не мають спільного інтерфейсу.

## Рішення

Розбийте алгоритм на кроки, перетворіть кожен крок на метод і викликайте ці методи по черзі з одного **шаблонного методу** в базовому класі. Кроки бувають трьох видів:

- **Абстрактні кроки** мусить реалізувати кожен підклас (розбір для кожного формату свій).
- **Кроки з типовою реалізацією** мають розумну реалізацію в базовому класі, яку підкласи *можуть* перевизначити (перевірка, збереження, звіт).
- **Хуки** (hooks) — необов'язкові кроки з порожнім тілом, розташовані перед важливими кроками чи після них. Алгоритм працює, навіть якщо їх ніхто не перевизначить. Це точки розширення для особливих випадків.

Кожен формат стає невеликим підкласом, що реалізує `parse()` і, за потреби, хук. Дубльовані кроки живуть в одному місці, а клієнтський код викликає `importer.run(raw)` для будь-якого імпортера без перевірок типу.

## Аналогія з життя

Мережа піцерій використовує в кожному закладі одну стандартну процедуру: замісити тісто, намастити соус, викласти начинку, спекти, нарізати. Процедуру затверджує головний офіс (шаблонний метод). Кожна піца з меню сама вирішує, що класти зверху (абстрактний крок). Час випікання має типове значення, яке піца на тонкому тісті може змінити (крок із типовою реалізацією). А клієнт може попросити додатковий сир перед випіканням (хук): якщо ніхто не просить, цей крок просто нічого не робить.

## Структура

```text
+----------------------------------------+
| AbstractClass (SalesImporter)          |
|----------------------------------------|
| + run(raw)        <- шаблонний метод   |
|     parse(raw)                         |
|     is_valid(sale)                     |
|     before_save(sales)                 |
|     save(sales)                        |
|     report(...)                        |
|----------------------------------------|
| + parse(raw)        {abstract}         |
| + is_valid(sale)    типовий            |
| + before_save(...)  хук (порожній)     |
| + save(...)         типовий            |
| + report(...)       типовий            |
+----------------------------------------+
           ^                     ^
           | успадковує          | успадковує
+---------------------+  +-------------------------+
| CsvImporter         |  | JsonImporter            |
|---------------------|  |-------------------------|
| + parse(raw)        |  | + parse(raw)            |
+---------------------+  | + before_save(sales)    |
                         +-------------------------+
```

1. **Абстрактний клас** оголошує шаблонний метод і кроки, які той викликає. Кроки можуть бути абстрактними або мати типову реалізацію.
2. **Конкретні класи** реалізують абстрактні кроки й можуть перевизначати кроки з типовою реалізацією та хуки. Сам шаблонний метод вони перевизначати не повинні.

## Реалізація на Python

```python
import csv
import io
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import final


@dataclass
class Sale:
    item: str
    amount: float


class SalesImporter(ABC):
    """Абстрактний клас: визначає кістяк алгоритму імпорту."""

    @final
    def run(self, raw: str) -> float:
        """Шаблонний метод. Підкласи не повинні його перевизначати."""
        sales = self.parse(raw)                                # 1. абстрактний крок
        valid = [sale for sale in sales if self.is_valid(sale)]  # 2. типовий крок
        self.before_save(valid)                                # 3. хук
        total = self.save(valid)                               # 4. типовий крок
        self.report(len(sales), valid, total)                  # 5. типовий крок
        return total

    @abstractmethod
    def parse(self, raw: str) -> list[Sale]:
        """Перетворює сирий текст на об'єкти Sale."""

    def is_valid(self, sale: Sale) -> bool:
        return sale.amount > 0

    def before_save(self, sales: list[Sale]) -> None:
        """Хук: нічого не робить, якщо підкласу це не потрібно."""

    def save(self, sales: list[Sale]) -> float:
        return sum(sale.amount for sale in sales)  # справжній застосунок писав би в БД

    def report(self, read: int, saved: list[Sale], total: float) -> None:
        names = [sale.item for sale in saved]
        print(f"{type(self).__name__}: read {read}, saved {names}, total {total:.2f}")


class CsvImporter(SalesImporter):
    def parse(self, raw: str) -> list[Sale]:
        reader = csv.DictReader(io.StringIO(raw))
        return [Sale(row["item"], float(row["amount"])) for row in reader]


class JsonImporter(SalesImporter):
    def parse(self, raw: str) -> list[Sale]:
        return [Sale(d["item"], float(d["amount"])) for d in json.loads(raw)]

    def before_save(self, sales: list[Sale]) -> None:  # підключається до хука
        for sale in sales:
            sale.item = sale.item.strip().lower()


csv_data = "item,amount\nkeyboard,1200\nmouse,-5\ncable,150\n"
json_data = '[{"item": " Monitor ", "amount": 7300}, {"item": "Hub", "amount": 0}]'

CsvImporter().run(csv_data)
JsonImporter().run(json_data)
```

Результат:

```text
CsvImporter: read 3, saved ['keyboard', 'cable'], total 1350.00
JsonImporter: read 2, saved ['monitor'], total 7300.00
```

На що звернути увагу:

- `CsvImporter` містить **лише** те, що стосується CSV. Перевірку, збереження й звіт написано один раз.
- `JsonImporter` використовує хук `before_save()`, щоб почистити назви товарів. `CsvImporter` хук ігнорує, і алгоритм усе одно працює.
- `@abstractmethod` робить `parse()` обов'язковим: Python не дасть створити імпортер, який про нього забув (див. «Типові помилки»).
- Базовий клас викликає `self.parse(...)`, але виконується метод підкласу. Таку інверсію інколи називають **голлівудським принципом**: «не телефонуйте нам, ми самі вам зателефонуємо». Керує базовий клас, і він викликає ваш код у потрібні моменти.

> **Зверніть увагу:** у Python немає ключового слова `final`. `typing.final` (Python 3.8+) позначає шаблонний метод як «не перевизначати», але дотримання цього перевіряють лише **статичні аналізатори**, як-от mypy і pyright. Під час виконання підклас усе одно може перевизначити `run()`. Давайте шаблонному методу зрозумілу назву, документуйте його й запускайте перевірку типів у CI.

## Практичний приклад: `collections.abc` і `unittest`

Стандартна бібліотека переповнена шаблонними методами. Чудовий приклад — абстрактні базові класи з `collections.abc`. `Mapping` оголошує три абстрактні кроки (`__getitem__`, `__iter__`, `__len__`) і надає багато готових методів (`get`, `keys`, `items`, `values`, `__contains__`, `__eq__`), які є **шаблонними методами, побудованими на цих трьох кроках**. Реалізуйте кроки — і отримаєте повний інтерфейс словника лише для читання задарма:

```python
from collections.abc import Iterator, Mapping


class CaseInsensitiveDict(Mapping[str, object]):
    """Відображення лише для читання, ключі якого не залежать від регістру."""

    def __init__(self, data: dict[str, object]) -> None:
        self._data = {key.lower(): value for key, value in data.items()}

    # Три примітивні операції, яких вимагає Mapping:
    def __getitem__(self, key: str) -> object:
        return self._data[key.lower()]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)


headers = CaseInsensitiveDict({"Content-Type": "text/html", "X-Request-ID": 42})

# Усе нижче успадковано від Mapping і побудовано на трьох методах вище
print(headers["content-type"])
print("CONTENT-TYPE" in headers)          # __contains__
print(headers.get("x-missing", "n/a"))    # get
print(list(headers.items()))              # items
print(headers == {"content-type": "text/html", "x-request-id": 42})  # __eq__
print(sorted(name for name in dir(Mapping) if not name.startswith("_")))
```

Результат:

```text
text/html
True
n/a
[('content-type', 'text/html'), ('x-request-id', 42)]
True
['get', 'items', 'keys', 'values']
```

`Mapping.get()` — шаблонний метод: він пробує `self[key]` і повертає типове значення, якщо виникає `KeyError`. Він не знає, як ваше відображення зберігає дані, а лише покладається на ваш `__getitem__`. Та сама ідея працює в `Sequence`, `MutableMapping`, `Set` та інших абстрактних класах.

`unittest.TestCase` — ще один шаблонний метод. Його `run()` викликає `setUp()`, потім тестовий метод, потім `tearDown()`. `setUp` і `tearDown` — хуки з порожніми типовими тілами:

```python
import unittest


class TemplateDemo(unittest.TestCase):
    def setUp(self) -> None:          # хук: перед кожним тестом
        print("setUp")
        self.items = [3, 1, 2]

    def tearDown(self) -> None:       # хук: після кожного тесту
        print("tearDown")

    def test_sorted(self) -> None:    # крок, який надаєте ви
        print("test_sorted")
        self.assertEqual(sorted(self.items), [1, 2, 3])


suite = unittest.defaultTestLoader.loadTestsFromTestCase(TemplateDemo)
result = unittest.TestResult()
suite.run(result)
print("ran:", result.testsRun, "failures:", len(result.failures))
```

Результат:

```text
setUp
test_sorted
tearDown
ran: 1 failures: 0
```

Інші приклади: `threading.Thread.start()` викликає ваш перевизначений `run()`, `socketserver.BaseRequestHandler` викликає `setup()`, `handle()` і `finish()`, а `html.parser.HTMLParser` під час розбору викликає `handle_starttag()`, `handle_data()` та подібні хуки.

## Коли застосовувати

- Ви хочете, щоб клієнти розширювали **окремі кроки** алгоритму, але не весь алгоритм і не його порядок.
- Кілька класів містять майже однакові алгоритми, що відрізняються кількома деталями. Коли алгоритм зміниться, доведеться правити їх усі.
- Ви будуєте фреймворк чи базовий клас і хочете дати користувачам чіткі точки розширення (абстрактні кроки й хуки), зберігши контроль над загальним потоком.

Якщо змінні частини мають змінюватися під час виконання або одному об'єкту потрібна комбінація варіантів, обирайте Стратегію: композиція гнучкіша за успадкування.

## Кроки реалізації

1. Проаналізуйте алгоритм і розбийте його на кроки. Вирішіть, які кроки спільні для всіх варіантів, а які завжди різні.
2. Створіть абстрактний базовий клас (`abc.ABC`). Напишіть шаблонний метод, що викликає кроки по черзі. Позначте його `@typing.final`, щоб задокументувати, що його не можна перевизначати.
3. Оголосіть кроки, які відрізняються, як `@abstractmethod`. Решті дайте типову реалізацію.
4. Додайте хуки з порожнім тілом у тих місцях, де підкласам може знадобитися втрутитися (зазвичай перед важливими кроками та після них). Не додавайте хуків «про всяк випадок»: кожен — це обіцянка, яку доведеться виконувати.
5. Для кожного варіанта алгоритму створіть підклас, що реалізує всі абстрактні кроки й перевизначає типові кроки чи хуки лише там, де потрібно.

## Переваги та недоліки

**Переваги:**

- Клієнти перевизначають лише ті частини великого алгоритму, які їх цікавлять, тож зміни в інших частинах менше на них впливають.
- Дубльований код переходить в один базовий клас.
- Базовий клас контролює порядок операцій, а це захищає інваріанти (наприклад, «перевірка завжди виконується перед збереженням»).

**Недоліки:**

- Кістяк обмежує клієнтів: підклас не може легко переставити кроки чи пропустити той, якого вимагає базовий клас.
- Підклас, що «вимикає» типовий крок (наприклад, змушує `is_valid()` завжди повертати `True`), може порушити *принцип підстановки Барбари Лісков*: він більше не поводиться так, як обіцяв базовий клас.
- Що більше кроків і хуків, то важче зрозуміти й підтримувати шаблонний метод. Читачеві доводиться стрибати між базовим класом і підкласами («проблема йо-йо»).
- Поведінка фіксується для класу. Замінити крок для одного об'єкта під час виконання без нового підкласу не вийде.

## Відносини з іншими патернами

- **Фабричний метод** — окремий випадок Шаблонного методу: шаблонний метод може викликати фабричний метод як один зі своїх кроків, даючи підкласам вирішити, який об'єкт створити.
- **Шаблонний метод проти Стратегії.** Шаблонний метод спирається на **успадкування**: ви змінюєте частини алгоритму через підкласи, і вибір робиться для класу, статично. Стратегія спирається на **композицію**: ви передаєте об'єкти чи функції, що реалізують змінні частини, і вибір робиться для об'єкта, навіть під час виконання. Вправа 3 нижче перетворює імпортер на версію з композицією.
- **Хуки та Спостерігач.** Хук, який лише повідомляє інший код («після збереження»), може перерости в подію в дусі Спостерігача, якщо знадобиться багато незалежних реакцій.

## Типові помилки

- **Забутий (або написаний з помилкою) абстрактний крок.** Саме від цього захищає `@abstractmethod`: помилка з'являється під час створення об'єкта, а не глибоко всередині алгоритму.

  ```python
  from abc import ABC, abstractmethod


  class Importer(ABC):
      def run(self, raw: str) -> None:
          print(self.parse(raw))

      @abstractmethod
      def parse(self, raw: str) -> list[str]: ...


  class BrokenImporter(Importer):
      def prase(self, raw: str) -> list[str]:  # друкарська помилка: крок не реалізовано
          return raw.split(",")


  try:
      BrokenImporter()
  except TypeError as exc:
      print(exc)
  ```

  Результат:

  ```text
  Can't instantiate abstract class BrokenImporter without an implementation for abstract method 'parse'
  ```

  Без `ABC` і `@abstractmethod` цей клас спокійно створився б і впав би лише під час виклику `run()`.

- **Виклик шаблонного методу з `__init__`.** Конструктор базового класу виконується раніше, ніж підклас встановить власні атрибути, тож перевизначені кроки бачать недобудований об'єкт:

  ```python
  class Report:
      def __init__(self) -> None:
          self.render()  # шаблонний метод викликається з конструктора

      def render(self) -> None:
          print(f"== {self.title()} ==")

      def title(self) -> str:
          return "Report"


  class SalesReport(Report):
      def __init__(self, region: str) -> None:
          super().__init__()  # render() виконується тут, коли self.region ще немає
          self.region = region

      def title(self) -> str:
          return f"Sales: {self.region}"


  try:
      SalesReport("west")
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Результат:

  ```text
  AttributeError: 'SalesReport' object has no attribute 'region'
  ```

  Тримайте конструктори простими, і нехай клієнт викликає шаблонний метод явно.

- **Перевизначення самого шаблонного методу.** Підклас, що переписує `run()`, руйнує гарантії кістяка (наприклад, може пропустити перевірку). Перевизначайте кроки, а не кістяк, і використовуйте `@final`, щоб це помічали статичні аналізатори.
- **Заміна типового кроку замість розширення.** `def is_valid(self, sale): return sale.item != ""` мовчки прибирає базову перевірку `amount > 0`. Якщо хочете додати правило, поєднайте їх: `return super().is_valid(sale) and sale.item != ""`.
- **Хуки, які треба викликати в особливий спосіб.** Хук має бути безпечним для ігнорування. Якщо підклас *мусить* викликати `super().before_save()`, щоб усе працювало, то це насправді замаскований обов'язковий крок.
- **Забагато дрібних кроків.** Шаблонний метод із п'ятнадцятьма хуками важко зрозуміти. Тримайте кількість точок розширення невеликою й переходьте на композицію, коли підкласи починають комбінувати непов'язані варіації.

## Підсумок

- Шаблонний метод визначає фіксований порядок кроків алгоритму в базовому класі. Підкласи налаштовують окремі кроки.
- Кроки бувають абстрактними (обов'язково перевизначити), типовими (можна перевизначити) і хуками (порожні, необов'язкові).
- У Python використовуйте `abc.ABC` з `@abstractmethod` для обов'язкових кроків і `typing.final`, щоб задокументувати шаблонний метод. `final` перевіряють лише статичні аналізатори.
- Базовий клас викликає код підкласу, а не навпаки («не телефонуйте нам, ми самі вам зателефонуємо»).
- `collections.abc`, `unittest.TestCase`, `threading.Thread` і `socketserver` побудовані на Шаблонному методі.
- Шаблонний метод використовує успадкування й працює на рівні класу. Стратегія використовує композицію й працює на рівні об'єкта. Обирайте Стратегію, коли кроки мають змінюватися під час виконання або вільно комбінуватися.
- Не викликайте шаблонні методи з `__init__` і не дозволяйте підкласам непомітно вимикати кроки, на які спирається базовий клас.

## Практика

### Вправа 1: Генератор звітів

Напишіть абстрактний `ReportGenerator` із шаблонним методом `render(title, rows) -> str`, де `rows` — список пар `(name, value)`. Шаблонний метод збирає результат із `header(title)` (абстрактний), виклику `format_row(name, value)` для кожного рядка (абстрактний) і `footer(rows)` (хук, що типово повертає порожній рядок і пропускається, якщо він порожній). Реалізуйте `PlainTextReport` і `MarkdownReport`. Підвал із підсумком має лише звіт у Markdown.

### Вправа 2: Штучний інтелект гри

Стратегічна гра виконує однаковий хід для кожного комп'ютерного гравця: зібрати ресурси, звести будівлі, створити юнітів, атакувати. Реалізуйте `GameAI.turn()` як шаблонний метод. `collect_resources()` і `attack()` мають типову реалізацію (`attack()` надсилає воїнів, якщо ворог у полі зору, і розвідників в іншому разі). `build_structures()`, `build_units()`, `send_scouts()` і `send_warriors()` — абстрактні. Напишіть `OrcsAI` (збирає 150 ресурсів, будує казарми за 100, тренує бійця за 50) і `MonstersAI` (ніколи нічого не збирає й не будує). Виконайте по одному ходу кожного.

### Вправа 3: Від успадкування до композиції

Перепишіть імпортер продажів без успадкування. Створіть один dataclass `Importer`, який отримує функцію `parse` і необов'язкову функцію `normalize` (заміну хука). Кістяк (розбір, перевірка, нормалізація, сума, звіт) лишається всередині `Importer.run()`. Відтворіть результат імпортерів CSV і JSON. А потім подумайте: що ви виграли, а що втратили?

## Розв'язки

### Вправа 1

```python
from abc import ABC, abstractmethod
from typing import final

Row = tuple[str, float]


class ReportGenerator(ABC):
    @final
    def render(self, title: str, rows: list[Row]) -> str:
        parts = [self.header(title)]
        parts += [self.format_row(name, value) for name, value in rows]
        footer = self.footer(rows)          # хук: може повернути ""
        if footer:
            parts.append(footer)
        return "\n".join(parts)

    @abstractmethod
    def header(self, title: str) -> str: ...

    @abstractmethod
    def format_row(self, name: str, value: float) -> str: ...

    def footer(self, rows: list[Row]) -> str:
        return ""


class PlainTextReport(ReportGenerator):
    def header(self, title: str) -> str:
        return f"{title.upper()}\n{'=' * len(title)}"

    def format_row(self, name: str, value: float) -> str:
        return f"{name:<10}{value:>8.2f}"


class MarkdownReport(ReportGenerator):
    def header(self, title: str) -> str:
        return f"## {title}\n\n| Name | Value |\n|---|---:|"

    def format_row(self, name: str, value: float) -> str:
        return f"| {name} | {value:.2f} |"

    def footer(self, rows: list[Row]) -> str:
        return f"| **Total** | **{sum(v for _, v in rows):.2f}** |"


data = [("Kyiv", 1200.5), ("Lviv", 830.0)]
print(PlainTextReport().render("Sales", data))
print()
print(MarkdownReport().render("Sales", data))
```

Результат:

```text
SALES
=====
Kyiv       1200.50
Lviv        830.00

## Sales

| Name | Value |
|---|---:|
| Kyiv | 1200.50 |
| Lviv | 830.00 |
| **Total** | **2030.50** |
```

### Вправа 2

```python
from abc import ABC, abstractmethod


class GameAI(ABC):
    def __init__(self, name: str, enemy_visible: bool) -> None:
        self.name = name
        self.enemy_visible = enemy_visible
        self.resources = 0

    def turn(self) -> None:
        """Шаблонний метод: порядок кроків однаковий для кожної раси."""
        print(f"--- {self.name}")
        self.collect_resources()
        self.build_structures()
        self.build_units()
        self.attack()

    def collect_resources(self) -> None:  # типовий крок
        self.resources += 150
        print(f"collected resources, now {self.resources}")

    @abstractmethod
    def build_structures(self) -> None: ...

    @abstractmethod
    def build_units(self) -> None: ...

    def attack(self) -> None:  # типовий крок, побудований на двох абстрактних
        if self.enemy_visible:
            self.send_warriors()
        else:
            self.send_scouts()

    @abstractmethod
    def send_scouts(self) -> None: ...

    @abstractmethod
    def send_warriors(self) -> None: ...


class OrcsAI(GameAI):
    def build_structures(self) -> None:
        if self.resources >= 100:
            self.resources -= 100
            print("built barracks")

    def build_units(self) -> None:
        if self.resources >= 50:
            self.resources -= 50
            print("trained a grunt")
        else:
            print("not enough resources for units")

    def send_scouts(self) -> None:
        print("orc scouts explore the map")

    def send_warriors(self) -> None:
        print("orc warriors charge!")


class MonstersAI(GameAI):
    def collect_resources(self) -> None:  # монстри пропускають цей крок
        pass

    def build_structures(self) -> None:
        pass

    def build_units(self) -> None:
        pass

    def send_scouts(self) -> None:
        print("monsters wander around")

    def send_warriors(self) -> None:
        print("monsters attack the nearest unit")


for ai in (OrcsAI("Orcs", enemy_visible=False), MonstersAI("Monsters", enemy_visible=True)):
    ai.turn()
```

Результат:

```text
--- Orcs
collected resources, now 150
built barracks
trained a grunt
orc scouts explore the map
--- Monsters
monsters attack the nearest unit
```

`attack()` — типовий крок, який сам працює як маленький шаблонний метод: він вирішує, *коли* викликати `send_scouts()` чи `send_warriors()`, а підкласи вирішують, *як*. `MonstersAI` перевизначає типовий крок порожнім тілом. Тут це законно, бо «нічого не збирати» — коректна поведінка для цієї раси, але саме такі перевизначення можуть зламати очікування в інших місцях.

### Вправа 3

```python
import csv
import io
import json
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class Sale:
    item: str
    amount: float


Parser = Callable[[str], list[Sale]]
Normalizer = Callable[[Sale], None]


def parse_csv(raw: str) -> list[Sale]:
    return [Sale(r["item"], float(r["amount"])) for r in csv.DictReader(io.StringIO(raw))]


def parse_json(raw: str) -> list[Sale]:
    return [Sale(d["item"], float(d["amount"])) for d in json.loads(raw)]


def lowercase_item(sale: Sale) -> None:
    sale.item = sale.item.strip().lower()


@dataclass
class Importer:
    """Той самий кістяк, але кроки передаються, а не успадковуються."""

    name: str
    parse: Parser
    normalize: Normalizer | None = None   # грає роль хука

    def run(self, raw: str) -> float:
        sales = self.parse(raw)
        valid = [sale for sale in sales if sale.amount > 0]
        if self.normalize is not None:
            for sale in valid:
                self.normalize(sale)
        total = sum(sale.amount for sale in valid)
        print(f"{self.name}: read {len(sales)}, saved {[s.item for s in valid]}, total {total:.2f}")
        return total


csv_data = "item,amount\nkeyboard,1200\nmouse,-5\ncable,150\n"
json_data = '[{"item": " Monitor ", "amount": 7300}, {"item": "Hub", "amount": 0}]'

Importer("csv", parse_csv).run(csv_data)
Importer("json", parse_json, normalize=lowercase_item).run(json_data)
```

Результат:

```text
csv: read 3, saved ['keyboard', 'cable'], total 1350.00
json: read 2, saved ['monitor'], total 7300.00
```

**Виграли:** немає ієрархії класів; парсери й нормалізатори можна вільно поєднувати (CSV з нормалізацією не потребує нового класу) і замінювати під час виконання; кожну функцію легко протестувати окремо. **Втратили:** «контракт» менш помітний. Абстрактний клас з `@abstractmethod` документує й примусово перевіряє, які кроки існують, а тут неправильну сигнатуру функції помітить лише статичний аналізатор або виконання програми. Коли пов'язаних кроків багато і вони ділять дані, базовий клас часто читається краще. Це класичний компроміс між Шаблонним методом (успадкування) і Стратегією (композиція).

---

*Джерела: [Refactoring.Guru — Шаблонний метод](https://refactoring.guru/design-patterns/template-method), [Refactoring.Guru — Шаблонний метод на Python](https://refactoring.guru/design-patterns/template-method/python/example). Адаптовано й доповнено для PyJourney.*
