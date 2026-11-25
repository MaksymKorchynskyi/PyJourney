# Відвідувач

**Відвідувач** (Visitor) — поведінковий патерн проєктування, який виносить операцію з класів, над якими вона працює, в окремий об'єкт — *відвідувача*. Щойно класи вміють «приймати» відвідувача, нові операції (експорт в XML, підрахунок підсумків, перевірку, друк) можна додавати, більше не змінюючи цих класів. На ньому тримаються компілятори, лінтери та форматери коду, а вбудований у Python `ast.NodeVisitor` теж є відвідувачем.

## Що ви дізнаєтесь

- Яку проблему розв'язує Відвідувач: як додавати операції до стабільної ієрархії класів, яку не хочеться чіпати
- Ролі в патерні: відвідувач, конкретний відвідувач, елемент, конкретний елемент і клієнт
- Що таке **подвійна диспетчеризація** (double dispatch) і навіщо елементам метод `accept()`
- Як реалізувати Відвідувача в Python, зокрема відвідувачів, що повертають значення, і відвідувачів, що накопичують стан під час обходу дерева
- Пайтонівські альтернативи: диспетчеризація за іменем, `functools.singledispatchmethod` і `match`
- Як `ast.NodeVisitor` і `ast.NodeTransformer` застосовують цей патерн у стандартній бібліотеці

## Суть патерна

Відвідувач відокремлює **алгоритм** від **структури об'єктів**, над якою той працює. Кожна операція стає окремим класом з одним методом на кожен тип елемента (`visit_city()`, `visit_industry()`, ...). Елементи зосереджуються на власній роботі, і їм потрібен лише крихітний універсальний «гачок» `accept(visitor)`, який передає елемент у потрібний метод відвідувача.

## Проблема

Уявіть команду, що розробляє застосунок довкола величезного графа географічних даних. Кожен вузол графа — об'єкт: місто, промислова зона, туристична місцевість тощо, і кожен вид вузла має власний клас. Вузли з'єднані, якщо між реальними місцями є дорога.

Одного дня вам доручають експортувати граф в XML. Очевидний план: додати метод `export_xml()` у кожен клас вузла й обійти граф, викликаючи його. Поліморфізм сам вибере потрібну реалізацію для кожного вузла, а код, що викликає експорт, не залежатиме від конкретних класів.

Архітектор системи відмовляє, і має на це вагомі причини:

- Класи вузлів уже працюють у продакшені. Правка всіх цих класів ризикує зламати те, що сьогодні працює.
- Експорт в XML не має нічого спільного з геоданими. Він виглядав би чужорідно в класах, чия справа — географія.
- XML — лише початок. Наступного місяця маркетинг захоче JSON, потім звіт у CSV, потім ще щось, і кожен такий запит означатиме нові правки тих самих крихких класів.

Отже, нову операцію треба розмістити **поза** класами. Перша ідея — окремий експортер, що перевіряє тип кожного вузла (ескіз, не для запуску):

```python
class XMLExporter:
    def export_city(self, city: City) -> str: ...
    def export_industry(self, industry: Industry) -> str: ...
    def export_sightseeing(self, place: Sightseeing) -> str: ...


def export_graph(graph: Graph, exporter: XMLExporter) -> None:
    for node in graph.nodes:
        if isinstance(node, City):
            exporter.export_city(node)
        elif isinstance(node, Industry):
            exporter.export_industry(node)
        elif isinstance(node, Sightseeing):
            exporter.export_sightseeing(node)
        # ...і ще одна гілка для кожного класу вузла, у кожній операції
```

Драбину перевірок `isinstance()` доведеться повторювати для кожної нової операції, гілку легко пропустити, і ніщо не попередить вас, коли з'явиться новий клас вузла.

У Java чи C# наступною ідеєю було б **перевантаження методів** (overloading): кілька методів `export()` з різними типами параметрів. Навіть там це не допомагає, адже перевантажений метод обирається під час компіляції за *оголошеним* типом змінної. У циклі по об'єктах `Node` оголошений тип завжди `Node`, тож компілятор щоразу обере версію `export(Node)`. У Python перевантаження немає взагалі. Другий `def` з тим самим іменем просто замінює перший:

```python
from dataclasses import dataclass


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


class Exporter:
    def export(self, shape: Circle) -> str:
        return "circle"

    def export(self, shape: Rectangle) -> str:  # мовчки ЗАМІНЮЄ перший метод
        return "rectangle"


print(Exporter().export(Circle(1)))
```

Результат:

```text
rectangle
```

Анотації типів не впливають на те, який метод виконається. У класі лишається один-єдиний `export()`.

## Рішення

Відвідувач переносить нову поведінку в окремий клас — **відвідувача** — з одним методом на кожен клас елемента. Елемент, який «мав би» виконати цю поведінку, передається в метод як аргумент, тож метод може прочитати всі потрібні дані.

Лишається питання, як викликати потрібний метод без драбини `isinstance()`. Хитрість у тому, щоб **дати вибір елементу**. Кожен елемент знає свій клас, тому кожен отримує маленький метод `accept()`, який викликає відповідний метод відвідувача:

```text
City.accept(visitor)        ->  visitor.visit_city(self)
Industry.accept(visitor)    ->  visitor.visit_industry(self)
Sightseeing.accept(visitor) ->  visitor.visit_sightseeing(self)
```

Тоді клієнт пише один цикл, що працює з будь-яким відвідувачем:

```text
for node in graph.nodes:
    node.accept(xml_exporter)
```

Так, класи вузлів таки довелося змінити. Але зміна крихітна, механічна й робиться **один раз**. Кожна майбутня операція (експорт у JSON, статистика, перевірка) — це новий клас відвідувача, а вузли більше ніхто не чіпає. Якщо всі відвідувачі мають спільний інтерфейс, кожен вузол працює з кожним відвідувачем, і нинішнім, і майбутнім.

### Подвійна диспетчеризація

Звичайний виклик методу `obj.method()` — це **одинарна диспетчеризація** (single dispatch): Python обирає реалізацію за типом *одного* об'єкта, `obj`. Відвідувачу ж потрібно, щоб вибір залежав від *двох* типів: який це елемент (місто, промзона) і яка це операція (експорт в XML, статистика). Патерн отримує таку **подвійну диспетчеризацію** з двох звичайних одинарних викликів поспіль:

```text
клієнт                      елемент: Circle                відвідувач: AreaVisitor
  |                               |                                |
  |  shape.accept(visitor)        |                                |
  |------------------------------>|  диспетчеризація #1: Python    |
  |                               |  обирає Circle.accept          |
  |                               |  за type(shape)                |
  |                               |                                |
  |                               |  visitor.visit_circle(self)    |
  |                               |------------------------------->|  диспетчеризація #2: Python
  |                               |                                |  обирає AreaVisitor.visit_circle
  |                               |                                |  за type(visitor)
  |<---------------------------------- результат ------------------|
```

1. `shape.accept(visitor)` розв'язується за типом елемента. Виконується `Circle.accept`, і всередині нього елемент «знає», що він коло.
2. `visitor.visit_circle(self)` розв'язується за типом відвідувача. `AreaVisitor.visit_circle` рахує площу, а `XMLExportVisitor.visit_circle` згенерував би XML.

Ні клієнт, ні відвідувач не перевіряють типів, і `isinstance()` ніде не з'являється.

## Аналогія з життя

Уявіть досвідченого страхового агента, який обходить квартал і заходить у кожну будівлю. Агент — це відвідувач, а його пропозиція залежить від того, хто займає будівлю:

- житловому будинку він пропонує медичне страхування;
- банку — страхування від крадіжок;
- кав'ярні — страхування від пожежі та затоплення.

Будівлі для цього не змінюються. Вони просто «приймають» візит і повідомляють, що вони таке. Завтра тією самою вулицею може пройти податковий інспектор чи пожежний інспектор і виконати зовсім іншу роботу, знову ж таки не змінивши жодної будівлі.

## Структура

```text
                         +--------------------------------------+
                         | <<abstract>> ShapeVisitor[T]         |
          +------------->|--------------------------------------|
          |              | + visit_dot(dot) -> T                |
          |              | + visit_circle(circle) -> T          |
          |              | + visit_rectangle(rect) -> T         |
          |              | + visit_compound_shape(group) -> T   |
          |              +--------------------------------------+
          |                      ^                     ^
          |                      :                     :
          |           +--------------------+  +--------------------+
          |           | XMLExportVisitor   |  | AreaVisitor        |
          |           | (усі visit_* ...)  |  | (усі visit_* ...)  |
          |           +--------------------+  +--------------------+
+--------+|
| Client |+---------->+--------------------------------------+
+--------+            | <<abstract>> Shape                   |
                      |--------------------------------------|
                      | + accept(visitor) -> T               |
                      +--------------------------------------+
                         ^            ^            ^
                         :            :            :
            +--------------+  +--------------+  +-------------------------+
            | Dot          |  | Circle       |  | CompoundShape           |
            | accept(v):   |  | accept(v):   |  | accept(v):              |
            |  v.visit_dot |  |  v.visit_    |  |  v.visit_compound_shape |
            |   (self)     |  |  circle(self)|  |   (self)                |
            +--------------+  +--------------+  +-------------------------+
```

1. **Відвідувач** (Visitor) оголошує набір методів відвідування, по одному для кожного конкретного класу елемента. У мовах з перевантаженням вони можуть мати однакове ім'я, а в Python потрібні різні імена, наприклад `visit_circle()`.
2. **Конкретні відвідувачі** реалізують одну операцію в кількох варіантах, по одному на кожен клас елемента.
3. **Елемент** (Element) оголошує метод `accept(visitor)`, параметр якого має тип інтерфейсу відвідувача.
4. **Конкретні елементи** реалізують `accept()`, викликаючи метод відвідування, що відповідає **їхньому власному** класу. Навіть якщо базовий клас елемента вже реалізує `accept()`, кожен підклас мусить його перевизначити, інакше відвідувач сприйме підклас як батьківський клас (див. «Типові помилки»).
5. **Клієнт** зазвичай тримає колекцію чи складну структуру, наприклад дерево Компонувальника (Composite). Він працює з елементами через абстрактний інтерфейс і не знає їхніх конкретних класів.

## Реалізація на Python

Приклад нижче додає операції до невеликої ієрархії фігур. Відвідувачів двоє: один експортує фігури в XML, інший рахує їхню площу. Тут `accept()` **повертає** те, що повернув відвідувач, і в Python це найзручніший стиль: XML-відвідувач видає рядки, а відвідувач площі — числа з рухомою комою.

```python
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class Shape(ABC):
    """Інтерфейс елемента: будь-яка фігура вміє приймати відвідувача."""

    @abstractmethod
    def accept[T](self, visitor: ShapeVisitor[T]) -> T: ...


@dataclass
class Dot(Shape):
    id: int
    x: float
    y: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_dot(self)  # «я — Dot»


@dataclass
class Circle(Shape):
    id: int
    x: float
    y: float
    radius: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_circle(self)

    def diameter(self) -> float:  # є лише в Circle, а не в Shape
        return 2 * self.radius


@dataclass
class Rectangle(Shape):
    id: int
    x: float
    y: float
    width: float
    height: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_rectangle(self)


@dataclass
class CompoundShape(Shape):
    id: int
    children: list[Shape] = field(default_factory=list)

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_compound_shape(self)


class ShapeVisitor[T](ABC):
    """Інтерфейс відвідувача: по методу на кожен конкретний клас елемента."""

    @abstractmethod
    def visit_dot(self, dot: Dot) -> T: ...

    @abstractmethod
    def visit_circle(self, circle: Circle) -> T: ...

    @abstractmethod
    def visit_rectangle(self, rect: Rectangle) -> T: ...

    @abstractmethod
    def visit_compound_shape(self, compound: CompoundShape) -> T: ...


class XMLExportVisitor(ShapeVisitor[str]):
    def visit_dot(self, dot: Dot) -> str:
        return f'<dot id="{dot.id}" x="{dot.x}" y="{dot.y}"/>'

    def visit_circle(self, circle: Circle) -> str:
        # Відвідувач знає конкретний клас, тож може викликати методи, які є лише в Circle
        return (f'<circle id="{circle.id}" x="{circle.x}" y="{circle.y}" '
                f'diameter="{circle.diameter()}"/>')

    def visit_rectangle(self, rect: Rectangle) -> str:
        return (f'<rectangle id="{rect.id}" x="{rect.x}" y="{rect.y}" '
                f'width="{rect.width}" height="{rect.height}"/>')

    def visit_compound_shape(self, compound: CompoundShape) -> str:
        inner = "\n".join(child.accept(self) for child in compound.children)
        inner = "\n".join("  " + line for line in inner.splitlines())
        return f'<compound id="{compound.id}">\n{inner}\n</compound>'


class AreaVisitor(ShapeVisitor[float]):
    def visit_dot(self, dot: Dot) -> float:
        return 0.0

    def visit_circle(self, circle: Circle) -> float:
        return math.pi * circle.radius ** 2

    def visit_rectangle(self, rect: Rectangle) -> float:
        return rect.width * rect.height

    def visit_compound_shape(self, compound: CompoundShape) -> float:
        return sum(child.accept(self) for child in compound.children)


def run_on_all[T](shapes: list[Shape], visitor: ShapeVisitor[T]) -> list[T]:
    """Клієнтський код: знає лише Shape і ShapeVisitor, жодних конкретних класів."""
    return [shape.accept(visitor) for shape in shapes]


drawing: list[Shape] = [
    Dot(1, 10, 20),
    CompoundShape(2, [Circle(3, 5, 5, 1.5), Rectangle(4, 0, 0, 4, 2.5)]),
]

for xml in run_on_all(drawing, XMLExportVisitor()):
    print(xml)
areas = run_on_all(drawing, AreaVisitor())
print([round(area, 2) for area in areas])
```

Результат:

```text
<dot id="1" x="10" y="20"/>
<compound id="2">
  <circle id="3" x="5" y="5" diameter="3.0"/>
  <rectangle id="4" x="0" y="0" width="4" height="2.5"/>
</compound>
[0.0, 17.07]
```

На що варто звернути увагу:

- `run_on_all()` — це клієнт. Він працює з **будь-яким** відвідувачем через базовий інтерфейс `ShapeVisitor`, і той самий цикл виконує і експорт в XML, і обчислення площі.
- Третя операція (скажімо, обчислення обмежувального прямокутника) — це один новий клас. Жоден клас фігури не змінюється.
- Кожен `accept()` — один рядок, що називає власний клас: `Circle.accept` викликає `visit_circle`. Цей рядок і є вся перша диспетчеризація.
- `visit_circle()` викликає `circle.diameter()` — метод, якого немає в інтерфейсі `Shape`. Відвідувач може користуватися повним API кожного конкретного класу, бо кожен метод відвідування точно знає, який клас отримав.
- `CompoundShape` не обходить дочірні фігури сам. Як їх поєднати, вирішує відвідувач: XML-відвідувач вкладає їх з відступом, а відвідувач площі підсумовує.

> **Зверніть увагу:** `def accept[T](...)` і `class ShapeVisitor[T](ABC)` використовують синтаксис узагальнень, що з'явився в Python 3.12. `T` — змінна типу: `XMLExportVisitor` є `ShapeVisitor[str]`, тому статичний аналізатор типів знає, що `shape.accept(XMLExportVisitor())` повертає `str`. Для Python 3.10 і 3.11 пишуть `T = TypeVar("T")` і `class ShapeVisitor(ABC, Generic[T])`. Рядок `from __future__ import annotations` дає змогу класу `Shape` згадувати `ShapeVisitor` ще до того, як той визначено.

### Хто обходить структуру?

Коли об'єкти утворюють дерево, хтось має вирішити, в якому порядку їх відвідувати. Є три поширені варіанти:

- **Відвідувач** обходить дочірні елементи, як це робить `visit_compound_shape()` вище. Це найгнучкіший варіант: кожен відвідувач може обрати прямий чи зворотний порядок обходу або взагалі пропустити піддерево.
- **Елементи** обходять своїх нащадків усередині `accept()` (викликають `visitor.visit_x(self)`, а потім `child.accept(visitor)` для кожного нащадка). Тоді кожен відвідувач отримує однаковий обхід без зусиль, але змінити його не може.
- **Окремий ітератор** видає елементи, а клієнт викликає `accept()` для кожного. Це поєднання Відвідувача з Ітератором.

`ast.NodeVisitor` (про нього далі) використовує гібрид: типовий `generic_visit()` обходить нащадків, а будь-який метод відвідування може замінити цей обхід.

## Практичний приклад: дерево виразів

Дерева виразів — класичне середовище для Відвідувача: інтерпретатори, компілятори, конструктори запитів і шаблонізатори зберігають код як дерево вузлів і виконують над ним багато незалежних операцій. Тут дерево має три типи вузлів, а три відвідувачі обчислюють його, друкують і збирають імена змінних.

Базовий відвідувач не абстрактний. Він надає **типові методи, які лише обходять дерево**, тож відвідувач, якого цікавить один вид вузлів, перевизначає лише один метод:

```python
from __future__ import annotations

import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


class Expr(ABC):
    @abstractmethod
    def accept(self, visitor: ExprVisitor) -> Any: ...


@dataclass(frozen=True)
class Number(Expr):
    value: float

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_number(self)


@dataclass(frozen=True)
class Variable(Expr):
    name: str

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_variable(self)


@dataclass(frozen=True)
class BinaryOp(Expr):
    op: str  # "+", "-", "*" або "/"
    left: Expr
    right: Expr

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_binary_op(self)


class ExprVisitor:
    """Базовий відвідувач: типово лише обходить дерево й повертає None."""

    def visit_number(self, node: Number) -> Any:
        return None

    def visit_variable(self, node: Variable) -> Any:
        return None

    def visit_binary_op(self, node: BinaryOp) -> Any:
        node.left.accept(self)
        node.right.accept(self)
        return None


class Printer(ExprVisitor):
    def visit_number(self, node: Number) -> str:
        return f"{node.value:g}"

    def visit_variable(self, node: Variable) -> str:
        return node.name

    def visit_binary_op(self, node: BinaryOp) -> str:
        return f"({node.left.accept(self)} {node.op} {node.right.accept(self)})"


class Evaluator(ExprVisitor):
    OPS = {"+": operator.add, "-": operator.sub,
           "*": operator.mul, "/": operator.truediv}

    def __init__(self, env: dict[str, float]) -> None:
        self.env = env

    def visit_number(self, node: Number) -> float:
        return node.value

    def visit_variable(self, node: Variable) -> float:
        if node.name not in self.env:
            raise NameError(f"variable {node.name!r} is not defined")
        return self.env[node.name]

    def visit_binary_op(self, node: BinaryOp) -> float:
        left = node.left.accept(self)
        right = node.right.accept(self)
        return self.OPS[node.op](left, right)


class VariableCollector(ExprVisitor):
    """Цікавиться лише змінними; решту дерева обходить базовий клас."""

    def __init__(self) -> None:
        self.names: list[str] = []

    def visit_variable(self, node: Variable) -> None:
        if node.name not in self.names:
            self.names.append(node.name)


# price * (1 + tax) - discount * price
expr = BinaryOp(
    "-",
    BinaryOp("*", Variable("price"), BinaryOp("+", Number(1), Variable("tax"))),
    BinaryOp("*", Variable("discount"), Variable("price")),
)

print(expr.accept(Printer()))
print(expr.accept(Evaluator({"price": 200, "tax": 0.2, "discount": 0.1})))

collector = VariableCollector()
expr.accept(collector)
print(collector.names)

try:
    expr.accept(Evaluator({"price": 200}))
except NameError as exc:
    print("NameError:", exc)
```

Результат:

```text
((price * (1 + tax)) - (discount * price))
220.0
['price', 'tax', 'discount']
NameError: variable 'tax' is not defined
```

Проєктні рішення в цій версії:

- **Вузли — це чисті дані.** `Number`, `Variable` і `BinaryOp` — заморожені dataclass-класи з однорядковим `accept()`. Обчислення, друк і аналіз живуть деінде, тож класи вузлів лишаються маленькими й стабільними.
- **Значення піднімаються вгору, стан накопичується.** `Printer` і `Evaluator` *повертають* результати й будують їх знизу вгору. `VariableCollector` нічого не повертає, а *накопичує* стан у `self.names` під час мандрівки деревом. Обидва стилі цілком законні. Збирати інформацію по всій структурі — одна з сильних сторін патерна.
- **Часткові відвідувачі.** `VariableCollector` реалізує лише `visit_variable()`. Це типовий випадок: поведінка, що має сенс лише для деяких класів ієрархії. Типові методи `ExprVisitor` продовжують обхід усіх інших вузлів.
- **Залежності передаються відвідувачу.** `Evaluator` отримує значення змінних у конструкторі. Одне й те саме дерево можна обчислювати з різними оточеннями, а вузли нічого про оточення не знають.

> **Порада:** базовий відвідувач з типовими методами міняє безпеку на зручність. Якщо згодом ви додасте вузол `FunctionCall` і забудете обробити його в `Evaluator`, типовий метод тихо поверне `None` замість того, щоб упасти. Коли операція **мусить** охоплювати всі типи вузлів, зробіть методи відвідувача абстрактними (як у `ShapeVisitor`), і Python відмовиться створювати неповного відвідувача.

## Пайтонівські альтернативи `accept()`

Класичний патерн існує тому, що мови на кшталт Java обирають метод лише за типом об'єкта-отримувача. Python гнучкіший, і є три поширені способи досягти того самого ефекту, часто **зовсім не змінюючи класи елементів**. Це важливо, коли класи належать бібліотеці, яку ви не можете змінювати.

### Диспетчеризація за іменем через `getattr()`

Відвідувач може сам скласти ім'я методу з імені класу й знайти цей метод. Саме так працює `ast.NodeVisitor`:

```python
import math
from dataclasses import dataclass
from typing import Any


@dataclass
class Circle:  # звичайні dataclass-класи: жодного accept()
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


@dataclass
class Group:
    children: list


class NodeVisitor:
    """Обирає visit_<ІмяКласу> за іменем, як це робить ast.NodeVisitor."""

    def visit(self, node: Any) -> Any:
        method = getattr(self, f"visit_{type(node).__name__}", self.generic_visit)
        return method(node)

    def generic_visit(self, node: Any) -> Any:
        raise TypeError(f"{type(self).__name__} cannot handle {type(node).__name__}")


class AreaCalculator(NodeVisitor):
    def visit_Circle(self, node: Circle) -> float:
        return math.pi * node.radius ** 2

    def visit_Rectangle(self, node: Rectangle) -> float:
        return node.width * node.height

    def visit_Group(self, node: Group) -> float:
        return sum(self.visit(child) for child in node.children)


scene = Group([Circle(1), Rectangle(2, 3), Group([Rectangle(1, 1)])])
print(round(AreaCalculator().visit(scene), 2))

try:
    AreaCalculator().visit("triangle")
except TypeError as exc:
    print("TypeError:", exc)
```

Результат:

```text
10.14
TypeError: AreaCalculator cannot handle str
```

Елементам не потрібен `accept()`, а відвідувач реалізує лише ті методи, які йому потрібні. Ціна: пошук іде за **іменем**, а не за типом. Підклас з іншим іменем (`class Square(Rectangle)`) не потрапить у `visit_Rectangle` і опиниться в `generic_visit()`, а метод з одруківкою, як-от `visit_Cirle`, просто ніколи не викличеться.

### `functools.singledispatchmethod`

`functools.singledispatch` перетворює функцію на **узагальнену функцію** (generic function), яка обирає реалізацію за типом першого аргументу. `singledispatchmethod` робить те саме для методів і диспетчеризує за першим аргументом після `self`. Реалізації реєструються за анотацією типу, а пошук іде ієрархією класів (за MRO), тому підкласи обробляються правильно:

```python
import math
from dataclasses import dataclass
from functools import singledispatchmethod


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


class Square(Rectangle):  # підклас, який ніхто не реєстрував
    def __init__(self, side: float) -> None:
        super().__init__(side, side)


@dataclass
class Group:
    children: list


class AreaCalculator:
    def __init__(self) -> None:
        self.visited = 0  # відвідувач може зберігати стан між викликами

    @singledispatchmethod
    def area(self, shape: object) -> float:
        raise TypeError(f"unsupported shape: {type(shape).__name__}")

    @area.register
    def _(self, shape: Circle) -> float:
        self.visited += 1
        return math.pi * shape.radius ** 2

    @area.register
    def _(self, shape: Rectangle) -> float:
        self.visited += 1
        return shape.width * shape.height

    @area.register
    def _(self, shape: Group) -> float:
        return sum(self.area(child) for child in shape.children)


calc = AreaCalculator()
print(round(calc.area(Group([Circle(1), Rectangle(2, 3), Square(2)])), 2))
print("shapes visited:", calc.visited)
try:
    calc.area(42)
except TypeError as exc:
    print("TypeError:", exc)
```

Результат:

```text
13.14
shapes visited: 3
TypeError: unsupported shape: int
```

`Square(2)` обробила реалізація для `Rectangle`, бо `Square` успадковує від нього. Метод без реєстрації — запасний варіант для всіх незареєстрованих типів, тож саме в ньому природно генерувати помилку.

Для звичайних функцій використовуйте `singledispatch`. Він працює з будь-якими типами, зокрема вбудованими, а починаючи з Python 3.11 `register` розуміє й анотації-об'єднання:

```python
from functools import singledispatch


@singledispatch
def to_text(value: object) -> str:
    return repr(value)  # запасний варіант для всіх незареєстрованих типів


@to_text.register
def _(value: int | float) -> str:  # типи-об'єднання: Python 3.11+
    return f"number {value}"


@to_text.register
def _(value: list) -> str:
    return "[" + ", ".join(to_text(item) for item in value) + "]"


print(to_text([1, 2.5, "a", [True]]))
print(to_text.dispatch(bool) is to_text.dispatch(int))
```

Результат:

```text
[number 1, number 2.5, 'a', [number True]]
True
```

Зверніть увагу на `number True`: `bool` — підклас `int`, тому `True` потрапляє в реалізацію для `int`. Зазвичай саме такої поведінки й хочеться, але якщо `bool` треба обробляти інакше, зареєструйте його окремо.

### Структурне зіставлення з шаблоном

Починаючи з Python 3.10, `match` уміє розгалужуватися за класом об'єкта й одразу розпаковувати його атрибути. Для невеликого закритого набору класів одна функція з `match` часто є найкоротшим способом записати операцію:

```python
import math
from dataclasses import dataclass
from typing import assert_never


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


@dataclass
class Group:
    children: list["Shape"]


type Shape = Circle | Rectangle | Group  # псевдонім типу, Python 3.12+


def area(shape: Shape) -> float:
    match shape:
        case Circle(radius=r):
            return math.pi * r ** 2
        case Rectangle(width=w, height=h):
            return w * h
        case Group(children=children):
            return sum(area(child) for child in children)
        case _:
            assert_never(shape)  # статичний аналізатор повідомить тут про пропущений випадок


def describe(shape: Shape) -> str:
    match shape:
        case Circle(radius=r) if r > 10:
            return "big circle"
        case Circle():
            return "circle"
        case Rectangle(width=w, height=h) if w == h:
            return f"square {w}x{h}"
        case Rectangle():
            return "rectangle"
        case Group(children=[]):
            return "empty group"
        case Group(children=children):
            return f"group of {len(children)}"
        case _:
            assert_never(shape)


scene = Group([Circle(1), Rectangle(2, 3), Group([])])
print(round(area(scene), 2))
print([describe(s) for s in (Circle(20), Rectangle(2, 2), *scene.children)])
try:
    area("triangle")
except AssertionError as exc:
    print("AssertionError:", exc)
```

Результат:

```text
9.14
['big circle', 'square 2x2', 'circle', 'rectangle', 'empty group']
AssertionError: Expected code to be unreachable, but got: 'triangle'
```

`case Circle(radius=r)` збігається з екземплярами `Circle` (і його підкласів) та прив'язує `r`. Шаблони можуть зазирати й усередину даних (`children=[]`) і мати умови-охоронці (`if w == h`), чого класичний відвідувач не вміє. `typing.assert_never()` (Python 3.11+) — запобіжник: під час виконання він генерує `AssertionError`, а статичний аналізатор типів, як-от mypy чи pyright, повідомить про помилку, якщо якийсь член об'єднання `Shape` не оброблено раніше.

### Що обрати?

| | Класичний `accept()` | За іменем через `getattr()` | `singledispatchmethod` | `match` |
|---|---|---|---|---|
| Класи елементів треба змінювати | Так, один раз | Ні | Ні | Ні |
| Працює з класами, які не можна редагувати | Ні | Так | Так (навіть із вбудованими) | Так |
| Підкласи потрапляють в обробник батьківського класу | Лише якщо перевизначають `accept()` | Ні (пошук за іменем) | Так (MRO) | Так |
| Пропущений обробник виявляється | Під час створення, якщо відвідувач абстрактний | Ні (потрапляє в `generic_visit`) | Ні (потрапляє в запасний варіант) | Статичним аналізатором з `assert_never` |
| Можна зіставляти за даними, а не лише за типом | Ні | Ні | Ні | Так |
| Типове застосування | Великі стабільні ієрархії, типізований код | Обхід дерев (`ast`) | Розширювані операції над багатьма типами | Невеликі закриті набори класів |

В усіх чотирьох варіантах ідея та сама: **операція над багатьма типами зібрана в одному місці, окремо від самих типів**. Класичну форму ви побачите в книжках і в коді, перенесеному з Java, C# чи C++. У коді на Python `singledispatch` і `match` нерідко виглядають природніше.

## Відвідувач у стандартній бібліотеці: `ast`

Модуль `ast` розбирає код на Python у дерево об'єктів-вузлів (`ast.FunctionDef`, `ast.Import`, `ast.Call`, ...). `ast.NodeVisitor` — відвідувач для цього дерева, і він використовує показану вище диспетчеризацію за іменем: `visit(node)` викликає `visit_<ІмяКласу>(node)`, якщо такий метод є, а інакше — `generic_visit(node)`, який відвідує всіх нащадків. Так побудовано лінтери, форматери й інструменти рефакторингу.

```python
import ast

source = '''
import json
from pathlib import Path


def load(path):
    """Read a JSON file."""
    return json.loads(Path(path).read_text())


def save(path, data):
    def encode(obj):
        return json.dumps(obj, indent=2)
    Path(path).write_text(encode(data))
'''


class CodeReport(ast.NodeVisitor):
    def __init__(self) -> None:
        self.imports: list[str] = []
        self.functions: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        self.imports += [alias.name for alias in node.names]

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.imports += [f"{node.module}.{alias.name}" for alias in node.names]

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        documented = ast.get_docstring(node) is not None
        self.functions.append(f"{node.name} (line {node.lineno}, docstring: {documented})")
        self.generic_visit(node)  # обходимо далі: всередині можуть бути вкладені функції


report = CodeReport()
report.visit(ast.parse(source))
print(report.imports)
print(*report.functions, sep="\n")
```

Результат:

```text
['json', 'pathlib.Path']
load (line 6, docstring: True)
save (line 11, docstring: False)
encode (line 12, docstring: False)
```

`CodeReport` — відвідувач зі станом: він збирає факти під час обходу дерева. Він реалізує лише три з понад сотні типів вузлів, а про решту дбає `generic_visit()`. Саме виклик `self.generic_visit(node)` усередині `visit_FunctionDef()` дає відвідувачу дістатися до `encode` — функції, вкладеної в `save`.

`ast.NodeTransformer` — відвідувач, що **повертає нові вузли**: те, що повертає метод `visit_*`, замінює початковий вузол у дереві (повернення `None` видаляє вузол). Так працюють інструменти, що переписують код:

```python
import ast


class PrintToLog(ast.NodeTransformer):
    """Переписує кожен виклик print(...) на log.info(...)."""

    def visit_Call(self, node: ast.Call) -> ast.Call:
        self.generic_visit(node)  # спершу перетворюємо аргументи
        if isinstance(node.func, ast.Name) and node.func.id == "print":
            node.func = ast.Attribute(
                value=ast.Name(id="log", ctx=ast.Load()), attr="info", ctx=ast.Load()
            )
        return node  # повернений вузол замінює початковий


code = """
print("start")
if debug:
    print("details:", len(items))
"""
tree = PrintToLog().visit(ast.parse(code))
print(ast.unparse(tree))
```

Результат:

```text
log.info('start')
if debug:
    log.info('details:', len(items))
```

`ast.unparse()` (Python 3.9+) перетворює дерево назад на код. Якщо перетворене дерево треба передати в `compile()`, спершу викличте `ast.fix_missing_locations(tree)`, бо нові вузли не мають номерів рядків.

> **Зверніть увагу:** у старих посібниках визначають `visit_Num` чи `visit_Str`. Починаючи з Python 3.8 усі літерали є вузлами `ast.Constant`, тож пишіть `visit_Constant`. Старі класи `ast.Num`, `ast.Str` і подібні видалено в Python 3.14.

## Коли застосовувати

- Потрібно виконати операцію над **усіма елементами складної структури** (дерева об'єктів, графа, документа, синтаксичного дерева), елементи якої належать до різних класів.
- Класи елементів **стабільні**, а нові операції все надходять. Ви хочете додавати їх, не правлячи елементи щоразу.
- Ви хочете тримати допоміжну поведінку (експорт, звіти, перевірки) **поза бізнес-класами**, щоб ті зосереджувалися на своїй основній роботі.
- Поведінка має сенс **лише для деяких класів** ієрархії. Відвідувач може реалізувати тільки потрібні методи, а решту залишити порожніми чи типовими.

Не застосовуйте Відвідувача, коли набір класів елементів часто змінюється: кожен новий клас елемента вимагає оновити всіх відвідувачів. А якщо операцій одна-дві, звичайні методи в класах простіші.

## Кроки реалізації

1. Оголосіть інтерфейс відвідувача з одним методом відвідування на кожен конкретний клас елемента (`visit_dot()`, `visit_circle()`, ...). Зробіть методи абстрактними, якщо кожен відвідувач мусить обробляти кожен елемент.
2. Оголосіть інтерфейс елемента. У наявній ієрархії додайте до базового класу абстрактний метод `accept(visitor)`.
3. Реалізуйте `accept()` у **кожному** конкретному класі елемента. Метод лише викликає метод відвідування, що відповідає власному класу елемента, і передає `self`.
4. Елементи працюють з відвідувачами лише через інтерфейс відвідувача. Відвідувачі ж знають усі конкретні класи елементів, адже саме ці класи є типами параметрів методів відвідування.
5. Для кожної нової поведінки створіть клас конкретного відвідувача й реалізуйте методи відвідування. Якщо відвідувачу потрібні дані, які елементи тримають приватними, відкрийте їх через публічні властивості лише для читання або перегляньте розподіл обов'язків. Справді приватних членів у Python немає, але читання `_атрибутів` ззовні прив'язує відвідувача до деталей реалізації.
6. Вирішіть, хто обходить складені структури: відвідувач, елементи чи ітератор.
7. У клієнті створюйте відвідувачів і передавайте їх елементам через `accept()`.

## Переваги та недоліки

**Переваги:**

- *Принцип відкритості/закритості*: нова операція над об'єктами різних класів — це новий клас відвідувача. Самі класи не змінюються.
- *Принцип єдиного обов'язку*: усі варіанти однієї операції зібрано в одному класі, а не розкидано по ієрархії.
- Відвідувач може **накопичувати інформацію**, обходячи структуру: лічильники, суми, знайдені імена, помилки.
- Відвідувач може викликати специфічні для класу методи кожного елемента, адже кожен метод відвідування знає, який конкретний клас отримав.

**Недоліки:**

- Додавання чи видалення класу елемента означає оновлення **всіх** відвідувачів.
- Відвідувачам може бракувати доступу до приватних даних елементів, і це спокушає розробників послабити інкапсуляцію.
- Подвійна диспетчеризація (`accept()` викликає метод відвідувача у відповідь) важко читається новачкам і додає шаблонного коду в кожен клас елемента.
- Відвідувач прив'язує операцію до форми ієрархії. Великі зміни ієрархії розходяться хвилею по всіх відвідувачах.

Цей компроміс відомий як **проблема виразів** (expression problem). Зі звичайними методами в класах додати новий *тип* легко (один новий клас), а нову *операцію* важко (треба правити кожен клас). Відвідувач перевертає це: операцію додати легко, а тип важко. Обирайте залежно від того, що змінюватиметься частіше.

## Відносини з іншими патернами

- **Відвідувач і Команда.** Відвідувача можна вважати потужнішою версією Команди: це об'єкт, що несе операцію, але виконати її він може над об'єктами багатьох різних класів.
- **Відвідувач і Компонувальник.** Відвідувач — природний спосіб виконати операцію над усім деревом Компонувальника (Composite), як показують `CompoundShape` і дерево виразів вище.
- **Відвідувач та Ітератор.** Ітератор може обходити складну структуру даних, а Відвідувач — виконувати операцію над кожним її елементом, навіть якщо елементи належать до різних класів.
- **Відвідувач проти Стратегії.** Стратегія замінює *один* алгоритм усередині об'єкта-контексту. Відвідувач несе *одну операцію з варіантом для кожного класу елемента* і застосовується до багатьох об'єктів.

## Типові помилки

- **Успадкований `accept()` у підкласі.** Підклас, що не перевизначає `accept()`, використовує батьківську версію, тож відвідувач отримує його через метод батьківського класу й обробляє як батька:

  ```python
  import math
  from dataclasses import dataclass


  @dataclass
  class Circle:
      radius: float

      def accept(self, visitor):
          return visitor.visit_circle(self)


  @dataclass
  class Ring(Circle):  # ПОМИЛКА: успадковує Circle.accept
      inner_radius: float = 0.0


  class AreaVisitor:
      def visit_circle(self, circle: Circle) -> float:
          return math.pi * circle.radius ** 2

      def visit_ring(self, ring: Ring) -> float:
          return math.pi * (ring.radius ** 2 - ring.inner_radius ** 2)


  ring = Ring(radius=2, inner_radius=1)
  print(round(ring.accept(AreaVisitor()), 2))  # пораховано як суцільне коло


  class FixedRing(Ring):
      def accept(self, visitor):
          return visitor.visit_ring(self)  # кожен конкретний елемент обирає власний метод


  print(round(FixedRing(radius=2, inner_radius=1).accept(AreaVisitor()), 2))
  ```

  Результат:

  ```text
  12.57
  9.42
  ```

  Жодної помилки, лише неправильна відповідь: дірку в кільці проігноровано. Перевизначайте `accept()` у кожному конкретному класі елемента.

- **Неправильний метод відвідування в `accept()`.** Скопіювавши `accept()` з `Circle` у `Rectangle` і забувши замінити `visit_circle` на `visit_rectangle`, ви відправите прямокутники в код для кіл. Кожен `accept()` має називати власний клас, а простий тест для кожного класу елемента виловлює таку помилку.

- **Новий клас елемента, а відвідувачів не оновлено.** Якщо інтерфейс відвідувача абстрактний, Python помітить це, щойно ви додасте новий абстрактний метод:

  ```python
  from abc import ABC, abstractmethod


  class ShapeVisitor(ABC):
      @abstractmethod
      def visit_circle(self, circle) -> float: ...

      @abstractmethod
      def visit_triangle(self, triangle) -> float: ...  # додано разом з новим класом Triangle


  class AreaVisitor(ShapeVisitor):  # написано ще до появи Triangle
      def visit_circle(self, circle) -> float:
          return 3.14 * circle.radius ** 2


  try:
      AreaVisitor()
  except TypeError as exc:
      print("TypeError:", exc)
  ```

  Результат:

  ```text
  TypeError: Can't instantiate abstract class AreaVisitor without an implementation for abstract method 'visit_triangle'
  ```

  З базовим відвідувачем, що має типові методи, чи з диспетчеризацією за іменем такий пропуск минає непомітно. Обирайте свідомо.

- **Забутий `generic_visit()` у відвідувачі дерева.** В `ast.NodeVisitor` визначення `visit_FunctionDef()` *замінює* типовий обхід для цього вузла. Без виклику `self.generic_visit(node)` нічого всередині функції не відвідується:

  ```python
  import ast


  class FunctionNames(ast.NodeVisitor):
      def __init__(self) -> None:
          self.names: list[str] = []

      def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
          self.names.append(node.name)  # ПОМИЛКА: немає self.generic_visit(node)


  finder = FunctionNames()
  finder.visit(ast.parse("def outer():\n    def inner():\n        pass\n"))
  print(finder.names)
  ```

  Результат:

  ```text
  ['outer']
  ```

  `inner` загубився. Викликайте `self.generic_visit(node)` щоразу, коли нащадків теж треба відвідати.

- **Повторне використання відвідувача зі станом.** Відвідувач, що збирає дані (як `VariableCollector` чи `CodeReport`), зберігає їх і після обходу. Якщо запустити його на другій структурі, результати змішаються. Створюйте нового відвідувача на кожен запуск або скидайте стан на початку публічного методу `run()`.
- **Відвідувач для ієрархії, що постійно змінюється.** Якщо нові класи елементів з'являються щотижня, кожен змушує змінювати всіх відвідувачів. У такому разі краще підходять звичайні поліморфні методи.
- **Заміна подвійної диспетчеризації драбиною `isinstance()`** усередині відвідувача. Так повертається саме та проблема, яку розв'язує патерн. Якщо `accept()` не хочеться, використайте `singledispatch` або `match`, які тримають диспетчеризацію в одному декларативному місці.

## Підсумок

- Відвідувач виносить операцію в окремий клас з одним методом на кожен клас елемента, тож нові операції можна додавати, не правлячи елементи.
- Елементи реалізують однорядковий `accept(visitor)`, що викликає метод відвідування для власного класу. Разом із викликом на відвідувачі це дає подвійну диспетчеризацію: код, що виконається, залежить і від типу елемента, і від типу відвідувача.
- У Python немає перевантаження методів, а анотації типів не впливають на вибір методу. Тому в класичному патерні методи відвідування мають явні імена (`visit_circle`).
- Відвідувачі можуть повертати значення (`accept()` повертає результат відвідувача) або накопичувати стан під час обходу структури, наприклад дерева Компонувальника.
- Пайтонівські альтернативи зберігають ідею, але обходяться без `accept()`: диспетчеризація за іменем (`ast.NodeVisitor`), `functools.singledispatch` / `singledispatchmethod` і `match`.
- `ast.NodeVisitor` і `ast.NodeTransformer` — відвідувачі зі стандартної бібліотеки. Не забувайте про `generic_visit()`, щоб обхід дерева тривав.
- Відвідувач робить нові операції дешевими, а нові класи елементів дорогими. Застосовуйте його, коли ієрархія стабільна, а кількість операцій зростає.

## Практика

### Вправа 1: Страховий агент

Змоделюйте аналогію з життя. Створіть елементи `ResidentialBuilding(address, residents)`, `Bank(name, vault_millions)` і `CoffeeShop(name, seats)` з методами `accept()`, абстрактний `BuildingVisitor` і двох відвідувачів:

- `InsuranceAgent` повертає пропозицію: медичне страхування для житлових будинків (з кількістю мешканців), страхування від крадіжок для банків, страхування від пожежі та затоплення для кав'ярень;
- `PremiumCalculator` повертає щомісячну ціну: 15 грн за мешканця, 1000 грн за кожен мільйон у сховищі банку та 500 грн плюс 20 грн за кожне місце в кав'ярні.

Обійдіть вулицю з трьох будівель і виведіть для кожної пропозицію та ціну. Цикл не повинен використовувати `isinstance()`.

### Вправа 2: Використання диска без `accept()`

Класи `File(name, size)` і `Directory(name, children)` належать бібліотеці, яку не можна змінювати, тому `accept()` у них немає. За допомогою `functools.singledispatchmethod` напишіть:

- `DiskUsage` з методом `size(node)`, що повертає розмір у байтах: файл повертає власний розмір, каталог — суму розмірів нащадків;
- `TreePrinter` з методом `show(node, depth=0)`, що збирає дерево з відступами в список `lines`, по чотири пробіли на рівень. Назви каталогів закінчуються на `/` і супроводжуються загальним розміром (використайте `DiskUsage`).

Невідомі типи вузлів мають генерувати `TypeError`. Перевірте все на теці проєкту з файлом, підтекою з двома файлами та порожньою текою.

### Вправа 3: Аудит коду з `ast.NodeVisitor`

Напишіть `FunctionAudit(ast.NodeVisitor)`, який для кожної функції у фрагменті коду записує:

- її ім'я;
- кількість параметрів (лише позиційні, звичайні, лише іменовані, а також `*args` і `**kwargs`, якщо вони є);
- чи має вона рядок документації (docstring);
- кількість інструкцій `if`, `for`, `while` і `try` **у власному тілі цієї функції**. Розгалуження всередині вкладеної функції належать вкладеній функції, а не зовнішній.

Методи, вкладені функції та функції `async def` теж мають потрапити у звіт. Виведіть по рядку на функцію й позначте функції без docstring.

## Розв'язки

### Вправа 1

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class Building(ABC):
    @abstractmethod
    def accept(self, visitor: BuildingVisitor) -> str: ...


@dataclass
class ResidentialBuilding(Building):
    address: str
    residents: int

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_residential(self)


@dataclass
class Bank(Building):
    name: str
    vault_millions: float

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_bank(self)


@dataclass
class CoffeeShop(Building):
    name: str
    seats: int

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_coffee_shop(self)


class BuildingVisitor(ABC):
    @abstractmethod
    def visit_residential(self, building: ResidentialBuilding) -> str: ...

    @abstractmethod
    def visit_bank(self, bank: Bank) -> str: ...

    @abstractmethod
    def visit_coffee_shop(self, shop: CoffeeShop) -> str: ...


class InsuranceAgent(BuildingVisitor):
    def visit_residential(self, building: ResidentialBuilding) -> str:
        return f"{building.address}: medical insurance for {building.residents} residents"

    def visit_bank(self, bank: Bank) -> str:
        return f"{bank.name}: theft insurance"

    def visit_coffee_shop(self, shop: CoffeeShop) -> str:
        return f"{shop.name}: fire and flood insurance"


class PremiumCalculator(BuildingVisitor):
    def visit_residential(self, building: ResidentialBuilding) -> str:
        return f"{building.residents * 15} UAH"

    def visit_bank(self, bank: Bank) -> str:
        return f"{bank.vault_millions * 1000:.0f} UAH"

    def visit_coffee_shop(self, shop: CoffeeShop) -> str:
        return f"{500 + shop.seats * 20} UAH"


street: list[Building] = [
    ResidentialBuilding("Shevchenka St 5", residents=40),
    Bank("City Bank", vault_millions=2.5),
    CoffeeShop("Corner Coffee", seats=24),
]

agent, calculator = InsuranceAgent(), PremiumCalculator()
for building in street:
    print(f"{building.accept(agent)} -> {building.accept(calculator)} per month")
```

Результат:

```text
Shevchenka St 5: medical insurance for 40 residents -> 600 UAH per month
City Bank: theft insurance -> 2500 UAH per month
Corner Coffee: fire and flood insurance -> 980 UAH per month
```

Цикл викликає `building.accept(...)` і ніколи не перевіряє тип: кожна будівля сама спрямовує відвідувача до потрібного методу. `PremiumCalculator` додано, не змінивши жодного класу будівлі, а саме це патерн і обіцяє.

### Вправа 2

```python
from dataclasses import dataclass, field
from functools import singledispatchmethod


# «Бібліотечні» класи: змінювати їх не можна, і accept() у них немає
@dataclass
class File:
    name: str
    size: int


@dataclass
class Directory:
    name: str
    children: list = field(default_factory=list)


class DiskUsage:
    @singledispatchmethod
    def size(self, node: object) -> int:
        raise TypeError(f"unknown node: {type(node).__name__}")

    @size.register
    def _(self, node: File) -> int:
        return node.size

    @size.register
    def _(self, node: Directory) -> int:
        return sum(self.size(child) for child in node.children)


class TreePrinter:
    def __init__(self) -> None:
        self.usage = DiskUsage()
        self.lines: list[str] = []

    @singledispatchmethod
    def show(self, node: object, depth: int = 0) -> None:
        raise TypeError(f"unknown node: {type(node).__name__}")

    @show.register
    def _(self, node: File, depth: int = 0) -> None:
        self.lines.append(f"{'    ' * depth}{node.name} ({node.size} B)")

    @show.register
    def _(self, node: Directory, depth: int = 0) -> None:
        self.lines.append(f"{'    ' * depth}{node.name}/ ({self.usage.size(node)} B)")
        for child in node.children:
            self.show(child, depth + 1)


project = Directory("project", [
    File("README.md", 1200),
    Directory("src", [File("main.py", 3400), File("utils.py", 800)]),
    Directory("empty"),
])

print(DiskUsage().size(project))
printer = TreePrinter()
printer.show(project)
print("\n".join(printer.lines))

try:
    DiskUsage().size("notes.txt")
except TypeError as exc:
    print("TypeError:", exc)
```

Результат:

```text
5400
project/ (5400 B)
    README.md (1200 B)
    src/ (4200 B)
        main.py (3400 B)
        utils.py (800 B)
    empty/ (0 B)
TypeError: unknown node: str
```

`singledispatchmethod` диспетчеризує за першим аргументом після `self`, тож додатковий параметр `depth` нічому не заважає. Його треба передавати після вузла, а сам вузол — позиційно. Бібліотечних класів ніхто не чіпав. `TreePrinter` поєднує двох відвідувачів: обходить дерево сам, а загальні розміри каталогів питає в `DiskUsage`.

### Вправа 3

```python
import ast
from dataclasses import dataclass


@dataclass
class FunctionInfo:
    name: str
    params: int
    documented: bool
    branches: int = 0


class FunctionAudit(ast.NodeVisitor):
    def __init__(self) -> None:
        self.report: list[FunctionInfo] = []
        self._stack: list[FunctionInfo] = []  # функції, всередині яких ми зараз перебуваємо

    def visit_FunctionDef(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        args = node.args
        params = len(args.posonlyargs) + len(args.args) + len(args.kwonlyargs)
        params += (args.vararg is not None) + (args.kwarg is not None)
        info = FunctionInfo(node.name, params, ast.get_docstring(node) is not None)
        self.report.append(info)
        self._stack.append(info)
        self.generic_visit(node)  # відвідуємо тіло (і вкладені функції)
        self._stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef  # async def обробляємо так само

    def _branch(self, node: ast.AST) -> None:
        if self._stack:  # зараховуємо лише найглибшій функції
            self._stack[-1].branches += 1
        self.generic_visit(node)

    visit_If = visit_For = visit_While = visit_Try = _branch


source = '''
class Shop:
    def checkout(self, cart, *, coupon=None):
        """Pay for the cart."""
        for item in cart:
            if item.price < 0:
                raise ValueError(item)
        if coupon:
            def apply(total):
                return total * 0.9 if total > 100 else total
        try:
            pay(cart)
        except PaymentError:
            retry(cart)


async def fetch(url, *args, **kwargs):
    while True:
        pass
'''

audit = FunctionAudit()
audit.visit(ast.parse(source))
for info in audit.report:
    flag = "" if info.documented else "  <- missing docstring"
    print(f"{info.name}: params={info.params}, branches={info.branches}{flag}")
```

Результат:

```text
checkout: params=3, branches=4
apply: params=1, branches=0  <- missing docstring
fetch: params=3, branches=1  <- missing docstring
```

Стек «функцій, всередині яких ми перебуваємо» — це стан відвідувача. Вхід у функцію додає її запис у стек, `generic_visit()` обходить тіло, а вихід знімає запис, тож розгалуження завжди зараховується найглибшій функції. У `checkout` чотири розгалуження (`for`, `if` усередині нього, `if coupon` і `try`), а `self` теж рахується як параметр. В `apply` розгалужень немає, бо `x if cond else y` — умовний *вираз* (`ast.IfExp`), а не інструкція `if`. Присвоєння одного методу кільком іменам (`visit_If = visit_For = ...`) — стислий спосіб обробляти кілька типів вузлів однаково. У Python 3.11+ можна додати ще й `visit_TryStar` для блоків `try` / `except*`.

---

*Джерела: [Refactoring.Guru — Відвідувач](https://refactoring.guru/design-patterns/visitor), [Refactoring.Guru — Відвідувач на Python](https://refactoring.guru/design-patterns/visitor/python/example). Адаптовано й доповнено для PyJourney.*
