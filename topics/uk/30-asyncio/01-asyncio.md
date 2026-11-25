# asyncio

`asyncio` — це фреймворк зі стандартної бібліотеки для написання **конкурентного** коду із синтаксисом `async`/`await`. Один потік виконує **цикл подій** (event loop), який перемикається між багатьма завданнями: поки одне чекає на мережу, базу даних чи таймер, цикл виконує інше. Саме тому один процес Python може одночасно обслуговувати тисячі повільних операцій вводу-виводу, а вебфреймворки, драйвери баз даних і боти будують на його основі.

## Що ви дізнаєтесь

- Що таке цикл подій і коли `asyncio` кращий за потоки чи процеси (задачі, обмежені вводом-виводом, проти задач, обмежених процесором)
- Як писати корутини за допомогою `async def` і `await` та запускати їх через `asyncio.run()`
- Як завдання (Task) роблять виконання корутин конкурентним і як чекати на багато завдань за допомогою `gather()`, `TaskGroup` та `as_completed()`
- Як задавати тайм-аути, скасовувати завдання й правильно обробляти `CancelledError`
- Як не блокувати цикл подій і як винести блокувальний код в окремий потік через `asyncio.to_thread()`
- Як координувати завдання за допомогою `Lock`, `Semaphore` і `Queue` та як працюють асинхронні ітератори й асинхронні менеджери контексту

## Конкурентність із циклом подій

Більшість програм багато часу **чекає**: на HTTP-відповідь, рядок із бази даних, файл, повідомлення із сокета. Звичайна (синхронна) програма під час очікування нічого не робить, хоча процесор міг би тим часом обробляти інший запит.

`asyncio` використовує **кооперативну багатозадачність**. Кожна корутина виконується, доки не дійде до `await` на чомусь, що ще не готове. У цей момент вона добровільно повертає керування **циклу подій**, а той обирає інше завдання, готове продовжити роботу.

```text
            +-----------------------------------------+
            |               цикл подій                |
            |  1. взяти завдання, готове до роботи    |
            |  2. виконувати його до наступного await |
            |  3. запам'ятати, на що воно чекає       |
            |  4. повторити                           |
            +-----------------------------------------+
                   |             |             |
                Task A        Task B        Task C
```

У кожен момент часу виконується лише одне завдання. Виграш у швидкості дає **накладання очікувань**, а не паралельне виконання коду Python:

```text
послідовно (await одне за одним)         конкурентно (Tasks)
A: |== чекає 1s ==|                      A: |== чекає 1s ==|
B:                |=== чекає 2s ===|     B: |=== чекає 2s ===|
разом: ~3s                               разом: ~2s
```

### asyncio, потоки чи процеси

У Python є три основні інструменти, щоб робити кілька справ одночасно. Вони розв'язують різні задачі:

| | `asyncio` | `threading` | `multiprocessing` |
|---|---|---|---|
| Одиниця роботи | корутина / Task | потік ОС | процес ОС |
| Хто перемикає | ваш код, на кожному `await` | ОС, у будь-який момент | ОС |
| Код Python виконується паралельно | ні (один потік) | ні, через GIL (крім free-threaded збірок, 3.13+) | так |
| Вартість однієї одиниці | мізерна: тисячі завдань — це нормально | помірна | висока |
| Найкраще підходить для | багатьох очікувань вводу-виводу (мережа, сокети, асинхронні драйвери БД) | вводу-виводу з блокувальними бібліотеками | обчислювальних задач |
| Головна небезпека | заблокувати цикл подій | гонитва даних (data race) на спільному стані | дані треба серіалізувати (pickle) між процесами |

Просте правило:

- Задачі, **обмежені вводом-виводом** (I/O-bound, програма здебільшого чекає), найкраще лягають на `asyncio` або на потоки, якщо бібліотека блокувальна.
- Задачі, **обмежені процесором** (CPU-bound, програма здебільшого рахує: обробка зображень, числові розрахунки), потребують процесів. `asyncio` їх не пришвидшить, бо одночасно виконується лише одна корутина.

Оскільки перемикання відбувається тільки на `await`, в асинхронному коді менше несподіванок, ніж у багатопотоковому: між двома `await` вас ніхто не перерве.

## Корутини: `async def` і `await`

Функція, оголошена через `async def`, — це **корутинна функція** (coroutine function). Її виклик **не** виконує тіло. Він повертає **об'єкт корутини** — призупинене обчислення, яке хтось має виконати.

```python
import asyncio


async def greet():
    print("greet() is running")
    return "hi"


coro = greet()        # нічого не виведено: тіло ще не почало виконуватися
print(type(coro))
print(asyncio.iscoroutine(coro))
coro.close()          # ми її так і не запустили, тож закриваємо, щоб не було попередження

print(asyncio.run(greet()))
```

Результат:

```text
<class 'coroutine'>
True
greet() is running
hi
```

`asyncio.run(coro)` — точка входу асинхронної програми. Ця функція створює новий цикл подій, виконує корутину до завершення, повертає її результат і закриває цикл. Викликайте її **один раз**, на верхньому рівні, зазвичай як `asyncio.run(main())`.

```python
import asyncio


async def main():
    print("hello")
    await asyncio.sleep(1)  # призупинити цю корутину на 1 секунду
    print("world")


asyncio.run(main())
```

Результат:

```text
hello
world
```

### Що робить `await`

`await something` означає: «виконай `something` і дай мені результат; якщо доведеться чекати, нехай цикл подій тим часом робить іншу роботу». `await` можна використовувати лише всередині функції `async def` і лише з **очікуваними об'єктами** (awaitable). Є три їхні види:

- **корутини**: те, що повертає функція `async def`;
- **завдання (Task)**: корутини, заплановані до виконання в циклі подій (наступний розділ);
- **ф'ючерси (Future)**: низькорівневі об'єкти, що представляють результат, який з'явиться пізніше. У прикладному коді їх рідко створюють напряму.

`await` на корутині виконує її **до кінця, перш ніж іти далі**. Тож ланцюжок `await` усе ще послідовний:

```python
import asyncio
import time


async def fetch(name, delay):
    print(f"start {name}")
    await asyncio.sleep(delay)  # удаємо, що чекаємо на мережу
    print(f"done  {name}")
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    a = await fetch("A", 1)
    b = await fetch("B", 2)
    print(a, b)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
start A
done  A
start B
done  B
A-data B-data
took 3.0s
```

Нічого не виконувалося конкурентно: `B` стартувала лише після завершення `A`. Щоб їхні очікування накладалися, потрібні завдання.

> **Порада:** `python -m asyncio` запускає REPL, у якому `await` можна писати просто на верхньому рівні, наприклад `await asyncio.sleep(1, result="hello")`. Це зручно для експериментів.

## Завдання: конкурентне виконання корутин

`asyncio.create_task(coro)` обгортає корутину в **завдання (Task)** і планує його в запущеному циклі подій. Завдання стартує, щойно поточна корутина поверне керування циклу (на її наступному `await`), і далі виконується **конкурентно** з усім іншим.

```python
import asyncio
import time


async def fetch(name, delay):
    print(f"start {name}")
    await asyncio.sleep(delay)
    print(f"done  {name}")
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    task_a = asyncio.create_task(fetch("A", 1))
    task_b = asyncio.create_task(fetch("B", 2))
    print("tasks created")

    a = await task_a  # main() тут призупиняється, і обидва завдання отримують змогу працювати
    b = await task_b
    print(a, b)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
tasks created
start A
start B
done  A
done  B
A-data B-data
took 2.0s
```

Зверніть увагу на порядок. Першим виводиться `"tasks created"`: створення завдання не запускає його негайно. Завдання стартують, коли `main()` доходить до `await task_a`. Далі обидва чекають одночасно, тому загальний час дорівнює найдовшій затримці (2 с), а не сумі (3 с).

Завдання — це дескриптор, який можна перевіряти й контролювати:

```python
import asyncio


async def compute(x):
    await asyncio.sleep(0.1)
    return x * 2


async def main():
    task = asyncio.create_task(compute(21), name="doubler")
    print(task.get_name(), task.done())
    result = await task
    print(result, task.done(), task.result())


asyncio.run(main())
```

Результат:

```text
doubler False
42 True 42
```

Корисні методи: `done()`, `result()`, `exception()`, `cancel()`, `cancelled()`, `get_name()` та `add_done_callback()`.

> **Зверніть увагу:** `create_task()` потребує запущеного циклу подій. Виклик поза корутиною згенерує `RuntimeError: no running event loop`.

## Очікування багатьох завдань: `gather()`

`asyncio.gather(*aws)` конкурентно виконує кілька очікуваних об'єктів і повертає список їхніх результатів. Передані корутини автоматично обгортаються в завдання. Результати повертаються **в тому порядку, в якому ви передали об'єкти**, а не в порядку завершення.

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        fetch("slow", 2),
        fetch("fast", 1),
        fetch("medium", 1.5),
    )
    print(results)

    names = ["x", "y", "z"]
    more = await asyncio.gather(*(fetch(name, 0.5) for name in names))
    print(more)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
['slow-data', 'fast-data', 'medium-data']
['x-data', 'y-data', 'z-data']
took 2.5s
```

### Помилки в `gather()`

За замовчуванням (`return_exceptions=False`) **перший** виняток передається тому, хто чекає на `gather()`. Інші об'єкти **не скасовуються**: вони продовжують працювати у фоні.

```python
import asyncio


async def fetch(name, delay, fail=False):
    await asyncio.sleep(delay)
    if fail:
        raise ConnectionError(f"{name} is unreachable")
    print(f"{name} finished")
    return f"{name}-data"


async def main():
    try:
        await asyncio.gather(
            fetch("a", 0.1),
            fetch("b", 0.2, fail=True),
            fetch("c", 0.5),
        )
    except ConnectionError as exc:
        print("caught:", exc)

    await asyncio.sleep(0.5)  # "c" усе ще працює, даємо їй час завершитися


asyncio.run(main())
```

Результат:

```text
a finished
caught: b is unreachable
c finished
```

З `return_exceptions=True` винятки вважаються звичайними результатами й потрапляють у список. Нічого не генерується, тож успіхи й помилки можна обробити разом:

```python
import asyncio


async def fetch(name, delay, fail=False):
    await asyncio.sleep(delay)
    if fail:
        raise ConnectionError(f"{name} is unreachable")
    return f"{name}-data"


async def main():
    results = await asyncio.gather(
        fetch("a", 0.1),
        fetch("b", 0.2, fail=True),
        fetch("c", 0.3),
        return_exceptions=True,
    )
    for result in results:
        if isinstance(result, Exception):
            print("error:", repr(result))
        else:
            print("ok:   ", result)


asyncio.run(main())
```

Результат:

```text
ok:    a-data
error: ConnectionError('b is unreachable')
ok:    c-data
```

## `TaskGroup`: сучасний вибір за замовчуванням (Python 3.11+)

`asyncio.TaskGroup` — це **асинхронний менеджер контексту**, який володіє групою завдань. Завдання створюють через `tg.create_task()`, а вихід із блоку `async with` чекає на завершення всіх. Такий підхід називають **структурованою конкурентністю** (structured concurrency): завдання не можуть пережити блок, який їх запустив.

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:
        task_a = tg.create_task(fetch("A", 1))
        task_b = tg.create_task(fetch("B", 2))
        print("tasks scheduled")
    # вихід із блоку відбувається лише після завершення всіх завдань групи
    print(task_a.result(), task_b.result())
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
tasks scheduled
A-data B-data
took 2.0s
```

Справжня перевага видна, коли щось ламається. Щойно одне завдання генерує виняток (крім `CancelledError`), група **скасовує всі інші завдання**, чекає на них і генерує `ExceptionGroup` з усіма помилками, що сталися. Обробляйте її через `except*` (Python 3.11+):

```python
import asyncio


async def fetch(name, delay, fail=False):
    try:
        await asyncio.sleep(delay)
        if fail:
            raise ConnectionError(f"{name} is unreachable")
        print(f"{name} finished")
        return f"{name}-data"
    except asyncio.CancelledError:
        print(f"{name} was cancelled")
        raise


async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(fetch("a", 0.1))
            tg.create_task(fetch("b", 0.2, fail=True))
            tg.create_task(fetch("c", 1.0))
    except* ConnectionError as group:
        for exc in group.exceptions:
            print("failed:", exc)


asyncio.run(main())
```

Результат:

```text
a finished
c was cancelled
failed: b is unreachable
```

Якщо перехопити групу звичайним `except ExceptionGroup as eg`, то `repr(eg)` матиме вигляд `ExceptionGroup('unhandled errors in a TaskGroup', [ConnectionError('b is unreachable')])`.

| | `gather()` | `TaskGroup` |
|---|---|---|
| Доступно з | завжди | Python 3.11 |
| На першій помилці | генерує її, інші завдання працюють далі | скасовує інші завдання, генерує `ExceptionGroup` |
| Помилки як значення | так, з `return_exceptions=True` | ні |
| Результати | список у порядку аргументів | `task.result()` кожного завдання |
| «Забуті» завдання після помилки | можливі | неможливі |

У новому коді віддавайте перевагу `TaskGroup`. `gather(..., return_exceptions=True)` доречний, коли потрібна поведінка «зробити що вдасться»: виконати все, а потім подивитися, які виклики завершилися помилкою.

> **Зверніть увагу:** у Python 3.15 з'явився `TaskGroup.cancel()`, який достроково завершує всю групу без помилки, наприклад коли група вже знайшла те, що шукала.

## Результати в міру готовності: `as_completed()`

Іноді кожен результат треба обробити **щойно він готовий**, наприклад щоб показувати прогрес. `asyncio.as_completed()` видає очікувані об'єкти в порядку завершення. Починаючи з Python 3.13, по ньому можна ітерувати через `async for`, і він повертає **початкові завдання**:

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return name


async def main():
    start = time.perf_counter()
    tasks = [
        asyncio.create_task(fetch("slow", 3)),
        asyncio.create_task(fetch("fast", 1)),
        asyncio.create_task(fetch("medium", 2)),
    ]
    async for task in asyncio.as_completed(tasks):  # Python 3.13+
        name = await task  # завдання вже завершене, тож результат повертається одразу
        print(f"{name:<6} ready after {time.perf_counter() - start:.0f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
fast   ready after 1s
medium ready after 2s
slow   ready after 3s
```

У старіших версіях використовуйте звичайний цикл `for`. Тоді кожна ітерація повертає **нову** корутину, на яку треба зробити `await`, щоб отримати наступний результат:

```python
# всередині main(), Python 3.12 і старіші
for next_done in asyncio.as_completed(tasks):
    name = await next_done
```

`as_completed()` також приймає `timeout=`. Якщо до цього часу завершилося не все, генерується `TimeoutError`, але решта завдань **не** скасовується.

## Тайм-аути

Ніколи не чекайте вічно на те, що може зависнути. В `asyncio` є два інструменти для цього.

### `asyncio.timeout()` (Python 3.11+)

`asyncio.timeout(delay)` — асинхронний менеджер контексту. Якщо код усередині виконується довше за `delay` секунд, поточне завдання скасовується, а на виході з блоку скасування перетворюється на `TimeoutError`. Тому `TimeoutError` перехоплюють **поза** `async with`:

```python
import asyncio


async def slow_operation():
    await asyncio.sleep(10)
    return "finished"


async def main():
    try:
        async with asyncio.timeout(1):
            result = await slow_operation()
            print(result)
    except TimeoutError:
        print("gave up after 1 second")

    print("the program continues")


asyncio.run(main())
```

Результат:

```text
gave up after 1 second
the program continues
```

Обмеження діє на **весь блок**, хоч скільки `await` у ньому. Передайте `None`, якщо ліміт поки невідомий, а пізніше змініть дедлайн через `cm.reschedule(new_deadline)`. `cm.expired()` показує, чи спрацював тайм-аут. `asyncio.timeout_at(when)` задає абсолютний дедлайн у шкалі `loop.time()`.

### `asyncio.wait_for()`

`asyncio.wait_for(aw, timeout)` обмежує **один** очікуваний об'єкт. Коли час вичерпано, функція скасовує його й генерує `TimeoutError`:

```python
import asyncio


async def slow_operation():
    await asyncio.sleep(10)
    return "finished"


async def main():
    try:
        await asyncio.wait_for(slow_operation(), timeout=0.5)
    except TimeoutError:
        print("timed out")

    result = await asyncio.wait_for(asyncio.sleep(0.1, result="quick"), timeout=0.5)
    print(result)


asyncio.run(main())
```

Результат:

```text
timed out
quick
```

> **Зверніть увагу:** починаючи з Python 3.11, `asyncio.TimeoutError` — просто псевдонім вбудованого `TimeoutError`. У версіях 3.10 і старіших перехоплюйте `asyncio.TimeoutError`.

## Скасування

`task.cancel()` просить завдання зупинитися. Завдання не «вбивається» миттєво: `asyncio.CancelledError` генерується **всередині** корутини на тому `await`, де вона зараз призупинена. Так корутина отримує змогу прибрати за собою в `try`/`finally`.

```python
import asyncio


async def worker():
    print("worker: started")
    try:
        while True:
            await asyncio.sleep(0.5)
            print("worker: tick")
    except asyncio.CancelledError:
        print("worker: cancelled, cleaning up")
        raise  # після прибирання завжди генеруйте виняток далі
    finally:
        print("worker: finally block runs")


async def main():
    task = asyncio.create_task(worker())
    await asyncio.sleep(1.2)

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("main: the worker is cancelled")
    print("cancelled():", task.cancelled())


asyncio.run(main())
```

Результат:

```text
worker: started
worker: tick
worker: tick
worker: cancelled, cleaning up
worker: finally block runs
main: the worker is cancelled
cancelled(): True
```

Що варто запам'ятати:

- `CancelledError` успадковується від `BaseException`, а не від `Exception` (починаючи з Python 3.8). Тому `except Exception:` випадково його не перехопить, і це саме те, що потрібно.
- Якщо ви перехоплюєте `CancelledError`, щоб прибрати ресурси, **генеруйте його далі**. `TaskGroup` і `asyncio.timeout()` усередині працюють через скасування й ламаються, якщо корутина його «ковтає».
- Для прибирання краще підходять `try`/`finally` (або `async with`): вони спрацьовують і при успіху, і при помилці, і при скасуванні.
- Скасування завдання, яке чекає на інше завдання чи ф'ючерс, скасовує й те: скасування поширюється вниз ланцюжком.
- `asyncio.shield(aw)` захищає внутрішню операцію від скасування разом із викликачем. Користуйтеся ним рідко, для операцій, які мусять завершитися, наприклад для запису фінального стану.

## Ніколи не блокуйте цикл подій

Цикл подій може перемкнути завдання лише на `await`. Звичайний блокувальний виклик на кшталт `time.sleep()`, `requests.get()` чи довгого обчислення займає єдиний потік, і **всі** завдання стоять, доки він не завершиться.

```python
import asyncio
import time


async def blocking_job(n):
    time.sleep(1)  # блокує весь цикл подій
    return n


async def friendly_job(n):
    await asyncio.sleep(1)  # призупиняє лише цю корутину
    return n


async def run_three(label, job):
    start = time.perf_counter()
    await asyncio.gather(job(1), job(2), job(3))
    print(f"{label}: {time.perf_counter() - start:.1f}s")


async def main():
    await run_three("time.sleep   ", blocking_job)
    await run_three("asyncio.sleep", friendly_job)


asyncio.run(main())
```

Результат (час приблизний):

```text
time.sleep   : 3.0s
asyncio.sleep: 1.0s
```

Три корутини `blocking_job` виконалися одна за одною, хоча й були «конкурентними». В асинхронному коді:

- чекайте через `await asyncio.sleep()`, ніколи через `time.sleep()`;
- для вводу-виводу використовуйте асинхронні бібліотеки (наприклад `aiohttp` чи `httpx` замість `requests`, асинхронні драйвери баз даних);
- якщо у вас довгий цикл на чистому Python, час від часу викликайте `await asyncio.sleep(0)`: це віддає керування циклу подій без реального очікування;
- під час розробки запускайте `asyncio.run(main(), debug=True)`: у режимі налагодження цикл записує в лог кожен крок, що блокує його довше ніж на 100 мс.

## Блокувальний код: `asyncio.to_thread()`

Іноді блокувального коду не уникнути: бібліотека без підтримки async, робота з файловою системою, застарілий SDK. `asyncio.to_thread(func, *args, **kwargs)` виконує функцію в окремому потоці й повертає корутину, на яку можна зробити `await`. Цикл подій тим часом лишається вільним.

```python
import asyncio
import time


def blocking_read(path):
    # звичайна блокувальна функція: повільний диск, застаріла бібліотека тощо
    time.sleep(1)
    return f"contents of {path}"


async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        asyncio.to_thread(blocking_read, "a.txt"),
        asyncio.to_thread(blocking_read, "b.txt"),
        asyncio.sleep(1, result="timer done"),
    )
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
['contents of a.txt', 'contents of b.txt', 'timer done']
took 1.0s
```

Через GIL потоки допомагають із блокувальним кодом, **обмеженим вводом-виводом**. Для функцій, **обмежених процесором**, використовуйте пул процесів через `loop.run_in_executor()`:

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor


def count_primes(limit):
    count = 0
    for n in range(2, limit):
        if all(n % d for d in range(2, int(n ** 0.5) + 1)):
            count += 1
    return count


async def main():
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        results = await asyncio.gather(
            *(loop.run_in_executor(pool, count_primes, limit)
              for limit in (10_000, 20_000, 30_000))
        )
    print(results)


if __name__ == "__main__":
    asyncio.run(main())
```

Результат:

```text
[1229, 2262, 3245]
```

## Синхронізація: `Lock` і `Semaphore`

Корутини виконуються в одному потоці, тому окрема інструкція на кшталт `counter += 1` ніколи не переривається. **Стан гонитви** (race condition) виникає лише тоді, коли корутина читає спільний стан, робить `await`, а потім діє на основі прочитаного: під час `await` інше завдання могло цей стан змінити.

### `asyncio.Lock`

```python
import asyncio


class Account:
    def __init__(self, balance):
        self.balance = balance
        self.lock = asyncio.Lock()

    async def withdraw_unsafe(self, amount):
        if self.balance >= amount:
            await asyncio.sleep(0.1)  # наприклад, виклик платіжного сервісу
            self.balance -= amount
            return True
        return False

    async def withdraw_safe(self, amount):
        async with self.lock:  # усередину потрапляє лише одне завдання за раз
            return await self.withdraw_unsafe(amount)


async def main():
    account = Account(100)
    results = await asyncio.gather(account.withdraw_unsafe(80), account.withdraw_unsafe(80))
    print("unsafe:", results, account.balance)

    account = Account(100)
    results = await asyncio.gather(account.withdraw_safe(80), account.withdraw_safe(80))
    print("safe:  ", results, account.balance)


asyncio.run(main())
```

Результат:

```text
unsafe: [True, True] -60
safe:   [True, False] 20
```

Без блокування обидва завдання перевірили баланс (100) ще до того, як хтось із них його зменшив, і рахунок пішов у мінус. З блокуванням перевірка й оновлення стають одним неподільним кроком.

> **Зверніть увагу:** `asyncio.Lock` **не** є потокобезпечним. Він координує завдання всередині одного циклу подій. Для потоків використовуйте `threading.Lock`.

### `asyncio.Semaphore`: обмеження конкурентності

Семафор — це лічильник вільних місць. `async with sem:` займає місце або чекає, доки якесь звільниться. Це стандартний спосіб сказати «не більше N запитів одночасно», наприклад щоб дотримуватися ліміту API або не відкривати 10 000 з'єднань за раз.

```python
import asyncio
import time


async def download(sem, n, start):
    async with sem:
        print(f"[{time.perf_counter() - start:.0f}s] start job {n}")
        await asyncio.sleep(1)
        return n * 10


async def main():
    sem = asyncio.Semaphore(2)  # не більше 2 завдань одночасно
    start = time.perf_counter()
    results = await asyncio.gather(*(download(sem, n, start) for n in range(6)))
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
[0s] start job 0
[0s] start job 1
[1s] start job 2
[1s] start job 3
[2s] start job 4
[2s] start job 5
[0, 10, 20, 30, 40, 50]
took 3.0s
```

Шість односекундних завдань на два місця займають приблизно три секунди. Інші примітиви з цієї ж родини: `asyncio.Event` (одне завдання сигналізує, багато чекають), `asyncio.Condition`, `asyncio.Barrier` (3.11+) і `asyncio.BoundedSemaphore` (генерує помилку, якщо його звільнили більше разів, ніж зайняли).

## Виробник і споживач з `asyncio.Queue`

`asyncio.Queue` передає елементи між завданнями. **Виробники** (producers) виконують `await queue.put(item)`, **споживачі** (consumers) — `await queue.get()`. Якщо задати `maxsize`, `put()` чекає, поки черга заповнена. Це автоматично пригальмовує виробника, який працює швидше за споживачів (такий механізм називають **зворотним тиском**, backpressure).

```python
import asyncio


async def producer(queue, count):
    for i in range(count):
        await queue.put(f"item-{i}")  # чекає, поки черга заповнена
        print(f"produced item-{i}")


async def consumer(name, queue, done):
    while True:
        item = await queue.get()  # чекає, поки черга порожня
        try:
            await asyncio.sleep(0.3)  # обробляємо елемент
            done.append(f"{name}:{item}")
        finally:
            queue.task_done()  # повідомляємо, що елемент оброблено


async def main():
    queue = asyncio.Queue(maxsize=2)
    done = []
    workers = [asyncio.create_task(consumer(f"w{i}", queue, done)) for i in range(2)]

    await producer(queue, 5)
    await queue.join()  # чекаємо, доки task_done() викличуть для кожного елемента

    for worker in workers:  # споживачі працюють у нескінченному циклі, тож зупиняємо їх
        worker.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    print(done)


asyncio.run(main())
```

Результат:

```text
produced item-0
produced item-1
produced item-2
produced item-3
produced item-4
['w0:item-0', 'w1:item-1', 'w0:item-2', 'w1:item-3', 'w0:item-4']
```

Як це працює: `queue.join()` повертає керування, коли кожному елементу, доданому через `put()`, відповідає виклик `task_done()`. Після цього споживачі простоюють, і `main()` їх скасовує.

Починаючи з Python 3.13, є акуратніший спосіб зупинити споживачів: `queue.shutdown()`. Після цього виклику `put()` одразу генерує `asyncio.QueueShutDown`, а `get()` генерує його, щойно черга спорожніє. Споживачі можуть самі вийти зі свого циклу:

```python
import asyncio


async def consumer(name, queue):
    while True:
        try:
            item = await queue.get()
        except asyncio.QueueShutDown:  # нових елементів більше не буде
            print(f"{name}: exiting")
            return
        await asyncio.sleep(0.1)
        print(f"{name} handled {item}")
        queue.task_done()


async def main():
    queue = asyncio.Queue()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(consumer("w0", queue))
        tg.create_task(consumer("w1", queue))
        for i in range(3):
            await queue.put(i)
        queue.shutdown()  # Python 3.13+


asyncio.run(main())
```

Результат:

```text
w0 handled 0
w1 handled 1
w1: exiting
w0 handled 2
w0: exiting
```

`w1` виходить раніше, ніж `w0` закінчує обробку елемента `2`: коли `w1` просить наступний елемент, черга вже порожня й закрита, тож `get()` одразу генерує виняток. `TaskGroup` чекає, доки повернуться обидва споживачі.

В `asyncio` є також `PriorityQueue` (першим виходить найменший елемент) і `LifoQueue` (останнім прийшов — першим вийшов).

## Асинхронна ітерація та асинхронні менеджери контексту

Звичайні `for` і `with` викликають синхронні методи. Коли отримання наступного елемента або вхід у блок і вихід із нього потребують вводу-виводу, використовують їхні асинхронні версії.

### Асинхронні генератори та `async for`

Функція `async def`, що містить `yield`, — це **асинхронний генератор**. По ньому ітерують через `async for`, який чекає (`await`) на кожен наступний елемент. Асинхронні включення (comprehensions) теж працюють:

```python
import asyncio


async def ticker(count, interval):
    for i in range(count):
        await asyncio.sleep(interval)  # наприклад, чекаємо на наступне повідомлення
        yield i


async def main():
    async for value in ticker(3, 0.2):
        print("tick", value)

    squares = [v * v async for v in ticker(4, 0.1)]
    print(squares)


asyncio.run(main())
```

Результат:

```text
tick 0
tick 1
tick 2
[0, 1, 4, 9]
```

Де це трапляється на практиці: читання потоку даних рядок за рядком, посторінкове отримання даних з API, споживання повідомлень із брокера.

Клас стає **асинхронним ітератором**, якщо реалізує `__aiter__()` (звичайний метод, що повертає ітератор) і `async def __anext__()`, який наприкінці генерує `StopAsyncIteration`:

```python
import asyncio


class Countdown:
    def __init__(self, start):
        self.current = start

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.current <= 0:
            raise StopAsyncIteration
        await asyncio.sleep(0.1)
        self.current -= 1
        return self.current + 1


async def main():
    async for n in Countdown(3):
        print(n)


asyncio.run(main())
```

Результат:

```text
3
2
1
```

### Асинхронні менеджери контексту та `async with`

**Асинхронний менеджер контексту** визначає `async def __aenter__()` і `async def __aexit__()`. Він потрібен, коли підготовка чи звільнення ресурсу передбачає очікування: відкриття з'єднання, захоплення блокування, початок транзакції. Декоратор `contextlib.asynccontextmanager` будує такий менеджер з асинхронного генератора, так само як `contextmanager` робить це для синхронного коду.

```python
import asyncio
from contextlib import asynccontextmanager


class Connection:
    def __init__(self, host):
        self.host = host

    async def __aenter__(self):
        await asyncio.sleep(0.1)  # удаємо, що підключаємося
        print(f"connected to {self.host}")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await asyncio.sleep(0.1)  # удаємо, що коректно закриваємо з'єднання
        print(f"disconnected from {self.host}")
        return False  # не пригнічуємо винятки

    async def query(self, sql):
        await asyncio.sleep(0.1)
        return f"result of {sql!r}"


@asynccontextmanager
async def transaction(conn):
    print("BEGIN")
    try:
        yield conn
    except Exception:
        print("ROLLBACK")
        raise
    else:
        print("COMMIT")


async def main():
    async with Connection("db.local") as conn:
        async with transaction(conn):
            print(await conn.query("SELECT 1"))


asyncio.run(main())
```

Результат:

```text
connected to db.local
BEGIN
result of 'SELECT 1'
COMMIT
disconnected from db.local
```

У цьому уроці ви вже користувалися асинхронними менеджерами контексту: `asyncio.TaskGroup()`, `asyncio.timeout()`, `asyncio.Lock()` і `asyncio.Semaphore()`.

## Типові помилки

- **Забутий `await`.** Виклик корутинної функції лише створює об'єкт корутини. Ваш код отримує цей об'єкт замість результату, а Python попереджає, що на корутину так і не зробили `await`:

  ```python
  import asyncio


  async def get_price():
      await asyncio.sleep(0.1)
      return 42


  async def main():
      price = get_price()  # забули await
      print(type(price).__name__)


  asyncio.run(main())
  ```

  Результат (попередження виводиться в stderr; шлях і номер рядка залежать від системи):

  ```text
  coroutine
  .../asyncio/events.py:94: RuntimeWarning: coroutine 'get_price' was never awaited
    self._context.run(self._callback, *self._args)
  RuntimeWarning: Enable tracemalloc to get the object allocation traceback
  ```

  Виправлення: `price = await get_price()`.

- **Блокування циклу подій.** `time.sleep()`, `requests.get()`, важкі обчислення чи синхронні драйвери баз даних усередині корутини заморожують усі інші завдання. Використовуйте `await asyncio.sleep()`, асинхронні бібліотеки, `asyncio.to_thread()` для блокувального вводу-виводу та пул процесів для важких обчислень.

- **Втрачені завдання «запустив і забув»** (fire-and-forget). Цикл подій тримає на завдання лише **слабке посилання** (weak reference). Якщо викликати `asyncio.create_task(job())` і не зберегти результат, збирач сміття може прибрати завдання ще до його завершення. Зберігайте сильне посилання або, ще краще, використовуйте `TaskGroup`:

  ```python
  import asyncio

  background_tasks = set()


  async def job(n):
      await asyncio.sleep(0.1)
      print("job", n, "done")


  async def main():
      for n in range(3):
          task = asyncio.create_task(job(n))
          background_tasks.add(task)  # сильне посилання тримає завдання «живим»
          task.add_done_callback(background_tasks.discard)  # прибираємо його після завершення
      await asyncio.sleep(0.2)
      print("still referenced:", len(background_tasks))


  asyncio.run(main())
  ```

  Результат:

  ```text
  job 0 done
  job 1 done
  job 2 done
  still referenced: 0
  ```

  На такі завдання ніхто не робить `await`, тож їхні винятки лише потрапляють у лог («Task exception was never retrieved»). `TaskGroup` розв'язує обидві проблеми.

- **«Ковтання» `CancelledError`.** `except asyncio.CancelledError: pass` (або голий `except:`) робить завдання нескасовним і ламає тайм-аути та групи завдань. Приберіть ресурси, а потім виконайте `raise`.

- **Виклик `asyncio.run()` усередині запущеного циклу.** Він генерує `RuntimeError: asyncio.run() cannot be called from a running event loop`. В асинхронному коді просто робіть `await` на корутині. У Jupyter, де цикл подій уже працює, пишіть у клітинці `await main()`.

- **Очікування, що `gather()` скасує решту завдань при помилці.** Він цього не робить. Якщо одна помилка має зупинити інші завдання, використовуйте `TaskGroup`.

- **`asyncio` для обчислювальних задач.** Корутини ділять один потік, тож чисті обчислення не пришвидшаться. Використовуйте `multiprocessing` або `ProcessPoolExecutor`.

## Підсумок

- `asyncio` дає конкурентність в одному потоці: цикл подій виконує одне завдання за раз і перемикається на кожному `await`. Він найкращий для задач, обмежених вводом-виводом. Обчислювальним задачам потрібні процеси.
- `async def` оголошує корутинну функцію. Її виклик створює об'єкт корутини, який нічого не робить, доки на ньому не зроблять `await` або не запланують його. `asyncio.run(main())` — точка входу програми.
- `await` виконує очікуваний об'єкт до кінця, тож кілька `await` поспіль виконуються послідовно. `asyncio.create_task()` планує корутини для конкурентного виконання.
- `TaskGroup` (3.11+) безпечно запускає групу завдань, `gather()` збирає результати в порядку аргументів (з `return_exceptions=True` помилки стають значеннями), а `as_completed()` дає обробляти результати в міру готовності.
- Захищайте очікування за допомогою `asyncio.timeout()` (3.11+) або `wait_for()`. Обидва генерують `TimeoutError`.
- Скасування генерує `CancelledError` усередині завдання. Прибирайте ресурси в `try`/`finally` і генеруйте виняток далі.
- Не блокуйте цикл подій: використовуйте `asyncio.sleep()`, асинхронні бібліотеки та `asyncio.to_thread()`.
- `Lock` захищає послідовності «прочитати — `await` — записати», `Semaphore` обмежує конкурентність, `Queue` з'єднує виробників і споживачів. `async for` і `async with` — асинхронні версії ітерації та менеджерів контексту.

## Практика

### Вправа 1: Передбачте порядок і час

Не запускаючи код, запишіть, що він виведе і скільки приблизно триватиме. Потім запустіть і поясніть результат.

```python
import asyncio
import time


async def step(name, delay):
    await asyncio.sleep(delay)
    print(name)


async def main():
    start = time.perf_counter()
    task = asyncio.create_task(step("A", 1.5))
    await step("B", 1)
    await step("C", 1)
    await task
    print(f"{time.perf_counter() - start:.0f}s")


asyncio.run(main())
```

### Вправа 2: Перевірка стану з частковими збоями

Напишіть `async def ping(host)`, яка «перевіряє» хост, засинаючи на `0.1 * len(host)` секунд, і повертає `"ok"`, але генерує `ConnectionError(f"{host} is down")`, якщо в імені хоста є `"bad"`. Потім напишіть `async def check_all(hosts)`, яка **конкурентно** перевіряє всі хости й повертає словник `{host: "ok" або "error: <повідомлення>"}`. Збій одного хоста не повинен зупиняти інші. Перевірте на `["api", "bad-db", "cache", "bad-queue"]`.

### Вправа 3: Ввічливий завантажувач

Потрібно «завантажити» 6 файлів. Файл `n` завантажується `n * 0.3` секунди (змоделюйте це через `asyncio.sleep`). Вимоги:

- одночасно виконується не більше 2 завантажень;
- кожне завантаження має тайм-аут 1 секунда; файл, який завантажується довше, позначається як `"timeout"`;
- використайте `TaskGroup` і поверніть список кортежів `(n, status)` у порядку файлів.

### Вправа 4: Конвеєр квадратів

Побудуйте конвеєр «виробник — споживач» з `asyncio.Queue(maxsize=3)`:

- виробник кладе в чергу числа від 1 до 10;
- три обробники беруть числа, «працюють» 0.1 с і додають квадрат числа до спільного списку;
- коли всі числа оброблено, обробники коректно зупиняються, а програма виводить відсортовані квадрати та їхню суму.

## Розв'язки

### Вправа 1

Результат (час приблизний):

```text
B
A
C
2s
```

`create_task()` планує `A` так, що вона завершиться через 1.5 с від старту. Потім `main()` чекає на `B` (завершується на 1-й секунді) і на `C` (стартує на 1-й секунді, завершується на 2-й). `A` виконувалася конкурентно з ними й завершилася на позначці 1.5 с, між `B` і `C`. Коли `main()` доходить до `await task`, `A` вже готова, тож загалом виходить близько 2 с замість 3.5 с.

### Вправа 2

```python
import asyncio


async def ping(host):
    await asyncio.sleep(0.1 * len(host))
    if "bad" in host:
        raise ConnectionError(f"{host} is down")
    return "ok"


async def check_all(hosts):
    results = await asyncio.gather(*(ping(h) for h in hosts), return_exceptions=True)
    report = {}
    for host, result in zip(hosts, results):
        if isinstance(result, Exception):
            report[host] = f"error: {result}"
        else:
            report[host] = result
    return report


report = asyncio.run(check_all(["api", "bad-db", "cache", "bad-queue"]))
for host, status in report.items():
    print(f"{host:<10} {status}")
```

Результат:

```text
api        ok
bad-db     error: bad-db is down
cache      ok
bad-queue  error: bad-queue is down
```

`gather()` зберігає порядок аргументів, тож `zip(hosts, results)` зіставляє кожен хост із його власним результатом. `return_exceptions=True` перетворює збої на звичайні значення, замість того щоб зупиняти все.

### Вправа 3

```python
import asyncio
import time


async def download(n, sem):
    async with sem:  # чекаємо на вільне місце
        try:
            async with asyncio.timeout(1):
                await asyncio.sleep(n * 0.3)  # «завантаження»
            return n, "ok"
        except TimeoutError:
            return n, "timeout"


async def main():
    sem = asyncio.Semaphore(2)
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(download(n, sem)) for n in range(1, 7)]
    results = [task.result() for task in tasks]
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Результат (час приблизний):

```text
[(1, 'ok'), (2, 'ok'), (3, 'ok'), (4, 'timeout'), (5, 'timeout'), (6, 'timeout')]
took 2.6s
```

Хронологія: файли 1 і 2 стартують одразу; файл 3 займає місце, що звільнилося на 0.3 с, файл 4 — місце, звільнене на 0.6 с, і так далі. Останній файл стартує на 1.6 с і отримує тайм-аут на 2.6 с. Тайм-аут розміщено **всередині** блоку семафора, тож він вимірює лише саме завантаження, а не час очікування вільного місця. Кожен `download()` сам перехоплює свій `TimeoutError`, тому жодне завдання не завершується помилкою, і `TaskGroup` нічого не скасовує.

### Вправа 4

```python
import asyncio


async def producer(queue):
    for n in range(1, 11):
        await queue.put(n)


async def worker(queue, squares):
    while True:
        n = await queue.get()
        try:
            await asyncio.sleep(0.1)  # удаємо, що працюємо
            squares.append(n * n)
        finally:
            queue.task_done()


async def main():
    queue = asyncio.Queue(maxsize=3)
    squares = []
    workers = [asyncio.create_task(worker(queue, squares)) for _ in range(3)]

    await producer(queue)
    await queue.join()  # кожне число оброблено

    for w in workers:
        w.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    print(sorted(squares))
    print("sum:", sum(squares))


asyncio.run(main())
```

Результат:

```text
[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
sum: 385
```

У Python 3.13+ замість скасування можна викликати `queue.shutdown()` після завершення виробника й дозволити обробникам вийти, коли `get()` згенерує `asyncio.QueueShutDown`, як показано в уроці.

---

*Джерела: [Python docs — asyncio: Asynchronous I/O](https://docs.python.org/3/library/asyncio.html), [Python docs — Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html). Адаптовано й доповнено для PyJourney.*
