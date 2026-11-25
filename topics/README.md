# PyJourney topics

135 Python topics in 32 categories, each written in English and Ukrainian. The categories and topics follow the order of the course table.

- English: [en/](en/)
- Українська: [uk/](uk/)

The app loads these files with `docker compose exec app python seed_topics.py`.

## Contents

- [01. Variables & Memory Management](#01) · Змінні та керування пам'яттю
- [02. Variable Scopes](#02) · Області видимості змінних
- [03. Closures](#03) · Замикання
- [04. Decorators](#04) · Декоратори
- [05. Sequence Types](#05) · Типи послідовностей
- [06. Iterables & Iterators](#06) · Ітеровані об'єкти та ітератори
- [07. Generators](#07) · Генератори
- [08. Context Managers](#08) · Менеджери контексту
- [09. Multithreading & Multiprocessing](#09) · Багатопотоковість і багатопроцесність
- [10. Classes & Objects](#10) · Класи та об'єкти
- [11. Special Methods](#11) · Спеціальні методи
- [12. Property](#12) · Властивості (property)
- [13. Single Inheritance](#13) · Одиночне успадкування
- [14. Enumerations](#14) · Переліки (enum)
- [15. SOLID Principles](#15) · Принципи SOLID
- [16. Multiple Inheritance](#16) · Множинне успадкування
- [17. Descriptors](#17) · Дескриптори
- [18. Meta Programming](#18) · Метапрограмування
- [19. Exceptions](#19) · Винятки
- [20. Introduction to unittest](#20) · Вступ до unittest
- [21. Assert Methods](#21) · Методи assert
- [22. Test Doubles](#22) · Тестові дублери
- [23. Test Coverage & Parameterized Tests](#23) · Покриття тестами та параметризовані тести
- [24. Basic Regular Expressions](#24) · Основи регулярних виразів
- [25. Quantifiers](#25) · Квантифікатори
- [26. Sets & Ranges](#26) · Набори та діапазони символів
- [27. Groupings](#27) · Групування
- [28. Look Around](#28) · Перегляд уперед і назад
- [29. Regex Functions](#29) · Функції регулярних виразів
- [30. asyncio — Asynchronous I/O](#30) · asyncio — асинхронний ввід-вивід
- [31. Design Patterns](#31) · Патерни проєктування
- [32. NumPy](#32) · NumPy

<a id="01"></a>

## 01. Variables & Memory Management · Змінні та керування пам'яттю

| # | English | Українська |
|---|---|---|
| 1 | [References](en/01-variables-and-memory-management/01-references.md) | [Посилання](uk/01-variables-and-memory-management/01-references.md) |
| 2 | [Garbage Collection](en/01-variables-and-memory-management/02-garbage-collection.md) | [Збирання сміття](uk/01-variables-and-memory-management/02-garbage-collection.md) |
| 3 | [Dynamic Typing](en/01-variables-and-memory-management/03-dynamic-typing.md) | [Динамічна типізація](uk/01-variables-and-memory-management/03-dynamic-typing.md) |
| 4 | [Mutable and Immutable](en/01-variables-and-memory-management/04-mutable-and-immutable.md) | [Змінювані та незмінювані об'єкти](uk/01-variables-and-memory-management/04-mutable-and-immutable.md) |
| 5 | [Python is operator](en/01-variables-and-memory-management/05-python-is-operator.md) | [Оператор is](uk/01-variables-and-memory-management/05-python-is-operator.md) |
| 6 | [Python None](en/01-variables-and-memory-management/06-python-none.md) | [Значення None](uk/01-variables-and-memory-management/06-python-none.md) |
| 7 | [Integers](en/01-variables-and-memory-management/07-integers.md) | [Цілі числа](uk/01-variables-and-memory-management/07-integers.md) |
| 8 | [Floor Division](en/01-variables-and-memory-management/08-floor-division.md) | [Цілочисельне ділення (floor division)](uk/01-variables-and-memory-management/08-floor-division.md) |
| 9 | [Modulo](en/01-variables-and-memory-management/09-modulo.md) | [Остача від ділення (modulo)](uk/01-variables-and-memory-management/09-modulo.md) |
| 10 | [Boolean](en/01-variables-and-memory-management/10-boolean.md) | [Булевий тип (bool)](uk/01-variables-and-memory-management/10-boolean.md) |
| 11 | [AND Operator](en/01-variables-and-memory-management/11-and-operator.md) | [Оператор and](uk/01-variables-and-memory-management/11-and-operator.md) |
| 12 | [OR Operator](en/01-variables-and-memory-management/12-or-operator.md) | [Оператор or](uk/01-variables-and-memory-management/12-or-operator.md) |
| 13 | [Float](en/01-variables-and-memory-management/13-float.md) | [Дробові числа (float)](uk/01-variables-and-memory-management/13-float.md) |
| 14 | [Converting Float to Int](en/01-variables-and-memory-management/14-converting-float-to-int.md) | [Перетворення float на int](uk/01-variables-and-memory-management/14-converting-float-to-int.md) |
| 15 | [Rounding](en/01-variables-and-memory-management/15-rounding.md) | [Округлення](uk/01-variables-and-memory-management/15-rounding.md) |
| 16 | [Decimal](en/01-variables-and-memory-management/16-decimal.md) | [Десяткові числа (Decimal)](uk/01-variables-and-memory-management/16-decimal.md) |

<a id="02"></a>

## 02. Variable Scopes · Області видимості змінних

| # | English | Українська |
|---|---|---|
| 1 | [Variable Scopes](en/02-variable-scopes/01-variable-scopes.md) | [Області видимості змінних](uk/02-variable-scopes/01-variable-scopes.md) |
| 2 | [nonlocal](en/02-variable-scopes/02-nonlocal.md) | [nonlocal](uk/02-variable-scopes/02-nonlocal.md) |

<a id="03"></a>

## 03. Closures · Замикання

| # | English | Українська |
|---|---|---|
| 1 | [Python Closures](en/03-closures/01-python-closures.md) | [Замикання в Python](uk/03-closures/01-python-closures.md) |

<a id="04"></a>

## 04. Decorators · Декоратори

| # | English | Українська |
|---|---|---|
| 1 | [Python Decorators](en/04-decorators/01-python-decorators.md) | [Декоратори в Python](uk/04-decorators/01-python-decorators.md) |
| 2 | [Python Decorator with Arguments](en/04-decorators/02-python-decorator-with-arguments.md) | [Декоратори з аргументами](uk/04-decorators/02-python-decorator-with-arguments.md) |
| 3 | [Python Class Decorators](en/04-decorators/03-python-class-decorators.md) | [Класи як декоратори](uk/04-decorators/03-python-class-decorators.md) |

<a id="05"></a>

## 05. Sequence Types · Типи послідовностей

| # | English | Українська |
|---|---|---|
| 1 | [Python Sequences](en/05-sequence-types/01-python-sequences.md) | [Послідовності в Python](uk/05-sequence-types/01-python-sequences.md) |
| 2 | [Tuple vs. List](en/05-sequence-types/02-tuple-vs-list.md) | [Кортеж чи список](uk/05-sequence-types/02-tuple-vs-list.md) |
| 3 | [Slicing in Depth](en/05-sequence-types/03-slicing-in-depth.md) | [Зрізи докладно](uk/05-sequence-types/03-slicing-in-depth.md) |
| 4 | [Fibonacci Sequence](en/05-sequence-types/04-fibonacci-sequence.md) | [Послідовність Фібоначчі](uk/05-sequence-types/04-fibonacci-sequence.md) |

<a id="06"></a>

## 06. Iterables & Iterators · Ітеровані об'єкти та ітератори

| # | English | Українська |
|---|---|---|
| 1 | [Iterators](en/06-iterables-and-iterators/01-iterators.md) | [Ітератори](uk/06-iterables-and-iterators/01-iterators.md) |
| 2 | [Iterator vs Iterable](en/06-iterables-and-iterators/02-iterator-vs-iterable.md) | [Ітератор та ітерований об'єкт](uk/06-iterables-and-iterators/02-iterator-vs-iterable.md) |
| 3 | [iter() Function](en/06-iterables-and-iterators/03-iter-function.md) | [Функція iter()](uk/06-iterables-and-iterators/03-iter-function.md) |

<a id="07"></a>

## 07. Generators · Генератори

| # | English | Українська |
|---|---|---|
| 1 | [Generators](en/07-generators/01-generators.md) | [Генератори](uk/07-generators/01-generators.md) |
| 2 | [Generator Expressions](en/07-generators/02-generator-expressions.md) | [Генераторні вирази](uk/07-generators/02-generator-expressions.md) |

<a id="08"></a>

## 08. Context Managers · Менеджери контексту

| # | English | Українська |
|---|---|---|
| 1 | [Context Managers](en/08-context-managers/01-context-managers.md) | [Менеджери контексту](uk/08-context-managers/01-context-managers.md) |

<a id="09"></a>

## 09. Multithreading & Multiprocessing · Багатопотоковість і багатопроцесність

| # | English | Українська |
|---|---|---|
| 1 | [Processes and Threads](en/09-multithreading-and-multiprocessing/01-processes-and-threads.md) | [Процеси та потоки](uk/09-multithreading-and-multiprocessing/01-processes-and-threads.md) |
| 2 | [Threading](en/09-multithreading-and-multiprocessing/02-threading.md) | [Потоки: модуль threading](uk/09-multithreading-and-multiprocessing/02-threading.md) |
| 3 | [Thread Pool](en/09-multithreading-and-multiprocessing/03-thread-pool.md) | [Пул потоків](uk/09-multithreading-and-multiprocessing/03-thread-pool.md) |
| 4 | [Threading Lock](en/09-multithreading-and-multiprocessing/04-threading-lock.md) | [Блокування потоків: Lock](uk/09-multithreading-and-multiprocessing/04-threading-lock.md) |
| 5 | [Multiprocessing](en/09-multithreading-and-multiprocessing/05-multiprocessing.md) | [Багатопроцесність: модуль multiprocessing](uk/09-multithreading-and-multiprocessing/05-multiprocessing.md) |
| 6 | [Process Pool](en/09-multithreading-and-multiprocessing/06-process-pool.md) | [Пул процесів](uk/09-multithreading-and-multiprocessing/06-process-pool.md) |

<a id="10"></a>

## 10. Classes & Objects · Класи та об'єкти

| # | English | Українська |
|---|---|---|
| 1 | [Python Object-oriented Programming](en/10-classes-and-objects/01-python-object-oriented-programming.md) | [Об'єктно-орієнтоване програмування в Python](uk/10-classes-and-objects/01-python-object-oriented-programming.md) |
| 2 | [Class](en/10-classes-and-objects/02-class.md) | [Клас](uk/10-classes-and-objects/02-class.md) |
| 3 | [Class Variables](en/10-classes-and-objects/03-class-variables.md) | [Змінні класу](uk/10-classes-and-objects/03-class-variables.md) |
| 4 | [Instance Methods](en/10-classes-and-objects/04-instance-methods.md) | [Методи екземпляра](uk/10-classes-and-objects/04-instance-methods.md) |
| 5 | [\_\_init\_\_: Initializing Instance Attributes](en/10-classes-and-objects/05-dunder-init-initializing-instance-attributes.md) | [\_\_init\_\_: ініціалізація атрибутів екземпляра](uk/10-classes-and-objects/05-dunder-init-initializing-instance-attributes.md) |
| 6 | [Instance Variables](en/10-classes-and-objects/06-instance-variables.md) | [Змінні екземпляра](uk/10-classes-and-objects/06-instance-variables.md) |
| 7 | [Private Attributes](en/10-classes-and-objects/07-private-attributes.md) | [Приватні атрибути](uk/10-classes-and-objects/07-private-attributes.md) |
| 8 | [Class Attributes](en/10-classes-and-objects/08-class-attributes.md) | [Атрибути класу](uk/10-classes-and-objects/08-class-attributes.md) |
| 9 | [Static Methods](en/10-classes-and-objects/09-static-methods.md) | [Статичні методи](uk/10-classes-and-objects/09-static-methods.md) |

<a id="11"></a>

## 11. Special Methods · Спеціальні методи

| # | English | Українська |
|---|---|---|
| 1 | [\_\_str\_\_](en/11-special-methods/01-dunder-str.md) | [\_\_str\_\_](uk/11-special-methods/01-dunder-str.md) |
| 2 | [\_\_repr\_\_](en/11-special-methods/02-dunder-repr.md) | [\_\_repr\_\_](uk/11-special-methods/02-dunder-repr.md) |
| 3 | [\_\_eq\_\_](en/11-special-methods/03-dunder-eq.md) | [\_\_eq\_\_](uk/11-special-methods/03-dunder-eq.md) |
| 4 | [\_\_hash\_\_](en/11-special-methods/04-dunder-hash.md) | [\_\_hash\_\_](uk/11-special-methods/04-dunder-hash.md) |
| 5 | [\_\_bool\_\_](en/11-special-methods/05-dunder-bool.md) | [\_\_bool\_\_](uk/11-special-methods/05-dunder-bool.md) |
| 6 | [\_\_del\_\_](en/11-special-methods/06-dunder-del.md) | [\_\_del\_\_](uk/11-special-methods/06-dunder-del.md) |

<a id="12"></a>

## 12. Property · Властивості (property)

| # | English | Українська |
|---|---|---|
| 1 | [Property](en/12-property/01-property.md) | [Властивості (property)](uk/12-property/01-property.md) |
| 2 | [@property Decorator](en/12-property/02-property-decorator.md) | [Декоратор @property](uk/12-property/02-property-decorator.md) |
| 3 | [Readonly Property](en/12-property/03-readonly-property.md) | [Властивості лише для читання](uk/12-property/03-readonly-property.md) |
| 4 | [Delete Property](en/12-property/04-delete-property.md) | [Видалення властивості](uk/12-property/04-delete-property.md) |

<a id="13"></a>

## 13. Single Inheritance · Одиночне успадкування

| # | English | Українська |
|---|---|---|
| 1 | [Single Inheritance](en/13-single-inheritance/01-single-inheritance.md) | [Одиночне успадкування](uk/13-single-inheritance/01-single-inheritance.md) |
| 2 | [Overriding Methods](en/13-single-inheritance/02-overriding-methods.md) | [Перевизначення методів](uk/13-single-inheritance/02-overriding-methods.md) |
| 3 | [super()](en/13-single-inheritance/03-super.md) | [super()](uk/13-single-inheritance/03-super.md) |
| 4 | [\_\_slots\_\_](en/13-single-inheritance/04-dunder-slots.md) | [\_\_slots\_\_](uk/13-single-inheritance/04-dunder-slots.md) |
| 5 | [Abstract Classes](en/13-single-inheritance/05-abstract-classes.md) | [Абстрактні класи](uk/13-single-inheritance/05-abstract-classes.md) |

<a id="14"></a>

## 14. Enumerations · Переліки (enum)

| # | English | Українська |
|---|---|---|
| 1 | [Enumeration](en/14-enumerations/01-enumeration.md) | [Перелік (Enum)](uk/14-enumerations/01-enumeration.md) |
| 2 | [Enum aliases & @enum.unique Decorator](en/14-enumerations/02-enum-aliases-and-enum-unique-decorator.md) | [Псевдоніми Enum і декоратор @enum.unique](uk/14-enumerations/02-enum-aliases-and-enum-unique-decorator.md) |
| 3 | [Customize & Extend Enum Classes](en/14-enumerations/03-customize-and-extend-enum-classes.md) | [Налаштування та розширення класів Enum](uk/14-enumerations/03-customize-and-extend-enum-classes.md) |
| 4 | [Enum auto](en/14-enumerations/04-enum-auto.md) | [auto(): автоматичні значення переліку](uk/14-enumerations/04-enum-auto.md) |

<a id="15"></a>

## 15. SOLID Principles · Принципи SOLID

| # | English | Українська |
|---|---|---|
| 1 | [Single Responsibility Principle](en/15-solid-principles/01-single-responsibility-principle.md) | [Принцип єдиної відповідальності](uk/15-solid-principles/01-single-responsibility-principle.md) |
| 2 | [Open–closed principle](en/15-solid-principles/02-open-closed-principle.md) | [Принцип відкритості/закритості](uk/15-solid-principles/02-open-closed-principle.md) |
| 3 | [Liskov Substitution Principle](en/15-solid-principles/03-liskov-substitution-principle.md) | [Принцип підстановки Лісков](uk/15-solid-principles/03-liskov-substitution-principle.md) |
| 4 | [Interface Segregation Principle](en/15-solid-principles/04-interface-segregation-principle.md) | [Принцип розділення інтерфейсів](uk/15-solid-principles/04-interface-segregation-principle.md) |
| 5 | [Dependency Inversion Principle](en/15-solid-principles/05-dependency-inversion-principle.md) | [Принцип інверсії залежностей](uk/15-solid-principles/05-dependency-inversion-principle.md) |

<a id="16"></a>

## 16. Multiple Inheritance · Множинне успадкування

| # | English | Українська |
|---|---|---|
| 1 | [Multiple Inheritance](en/16-multiple-inheritance/01-multiple-inheritance.md) | [Множинне успадкування](uk/16-multiple-inheritance/01-multiple-inheritance.md) |

<a id="17"></a>

## 17. Descriptors · Дескриптори

| # | English | Українська |
|---|---|---|
| 1 | [Descriptors](en/17-descriptors/01-descriptors.md) | [Дескриптори](uk/17-descriptors/01-descriptors.md) |
| 2 | [Data vs. Non-data Descriptors](en/17-descriptors/02-data-vs-non-data-descriptors.md) | [Дескриптори даних і не-даних](uk/17-descriptors/02-data-vs-non-data-descriptors.md) |

<a id="18"></a>

## 18. Meta Programming · Метапрограмування

| # | English | Українська |
|---|---|---|
| 1 | [\_\_new\_\_ Method](en/18-meta-programming/01-dunder-new-method.md) | [Метод \_\_new\_\_](uk/18-meta-programming/01-dunder-new-method.md) |
| 2 | [type Class](en/18-meta-programming/02-type-class.md) | [Клас type](uk/18-meta-programming/02-type-class.md) |
| 3 | [Metaclass](en/18-meta-programming/03-metaclass.md) | [Метаклас](uk/18-meta-programming/03-metaclass.md) |
| 4 | [Metaclass Example](en/18-meta-programming/04-metaclass-example.md) | [Приклад метакласу](uk/18-meta-programming/04-metaclass-example.md) |

<a id="19"></a>

## 19. Exceptions · Винятки

| # | English | Українська |
|---|---|---|
| 1 | [Exceptions](en/19-exceptions/01-exceptions.md) | [Винятки](uk/19-exceptions/01-exceptions.md) |
| 2 | [Exception Handling](en/19-exceptions/02-exception-handling.md) | [Обробка винятків](uk/19-exceptions/02-exception-handling.md) |
| 3 | [Raise Exceptions](en/19-exceptions/03-raise-exceptions.md) | [Генерування винятків](uk/19-exceptions/03-raise-exceptions.md) |
| 4 | [Raise From](en/19-exceptions/04-raise-from.md) | [Raise From](uk/19-exceptions/04-raise-from.md) |
| 5 | [Custom Exceptions](en/19-exceptions/05-custom-exceptions.md) | [Власні винятки](uk/19-exceptions/05-custom-exceptions.md) |

<a id="20"></a>

## 20. Introduction to unittest · Вступ до unittest

| # | English | Українська |
|---|---|---|
| 1 | [Unittest Framework](en/20-introduction-to-unittest/01-unittest-framework.md) | [Фреймворк unittest](uk/20-introduction-to-unittest/01-unittest-framework.md) |
| 2 | [Test Fixtures](en/20-introduction-to-unittest/02-test-fixtures.md) | [Тестові оточення (fixtures)](uk/20-introduction-to-unittest/02-test-fixtures.md) |
| 3 | [Skipping Tests](en/20-introduction-to-unittest/03-skipping-tests.md) | [Пропуск тестів](uk/20-introduction-to-unittest/03-skipping-tests.md) |
| 4 | [Running Tests](en/20-introduction-to-unittest/04-running-tests.md) | [Запуск тестів](uk/20-introduction-to-unittest/04-running-tests.md) |

<a id="21"></a>

## 21. Assert Methods · Методи assert

| # | English | Українська |
|---|---|---|
| 1 | [Assert Methods](en/21-assert-methods/01-assert-methods.md) | [Методи-твердження (assert methods)](uk/21-assert-methods/01-assert-methods.md) |
| 2 | [assertEqual()](en/21-assert-methods/02-assertequal.md) | [assertEqual()](uk/21-assert-methods/02-assertequal.md) |
| 3 | [assertAlmostEqual()](en/21-assert-methods/03-assertalmostequal.md) | [assertAlmostEqual()](uk/21-assert-methods/03-assertalmostequal.md) |
| 4 | [assertIsInstance()](en/21-assert-methods/04-assertisinstance.md) | [assertIsInstance()](uk/21-assert-methods/04-assertisinstance.md) |
| 5 | [assertIsNone()](en/21-assert-methods/05-assertisnone.md) | [assertIsNone()](uk/21-assert-methods/05-assertisnone.md) |
| 6 | [assertTrue()](en/21-assert-methods/06-asserttrue.md) | [assertTrue()](uk/21-assert-methods/06-asserttrue.md) |
| 7 | [assertIn()](en/21-assert-methods/07-assertin.md) | [assertIn()](uk/21-assert-methods/07-assertin.md) |

<a id="22"></a>

## 22. Test Doubles · Тестові дублери

| # | English | Українська |
|---|---|---|
| 1 | [Mocks](en/22-test-doubles/01-mocks.md) | [Моки (Mock)](uk/22-test-doubles/01-mocks.md) |
| 2 | [patch()](en/22-test-doubles/02-patch.md) | [patch()](uk/22-test-doubles/02-patch.md) |
| 3 | [Stubs](en/22-test-doubles/03-stubs.md) | [Заглушки (stubs)](uk/22-test-doubles/03-stubs.md) |
| 4 | [Mocking requests Module](en/22-test-doubles/04-mocking-requests-module.md) | [Моки для модуля requests](uk/22-test-doubles/04-mocking-requests-module.md) |

<a id="23"></a>

## 23. Test Coverage & Parameterized Tests · Покриття тестами та параметризовані тести

| # | English | Українська |
|---|---|---|
| 1 | [Test Coverage](en/23-test-coverage-and-parameterized-tests/01-test-coverage.md) | [Покриття тестами](uk/23-test-coverage-and-parameterized-tests/01-test-coverage.md) |
| 2 | [Parameterized Tests](en/23-test-coverage-and-parameterized-tests/02-parameterized-tests.md) | [Параметризовані тести](uk/23-test-coverage-and-parameterized-tests/02-parameterized-tests.md) |

<a id="24"></a>

## 24. Basic Regular Expressions · Основи регулярних виразів

| # | English | Українська |
|---|---|---|
| 1 | [Regular Expressions](en/24-basic-regular-expressions/01-regular-expressions.md) | [Регулярні вирази](uk/24-basic-regular-expressions/01-regular-expressions.md) |
| 2 | [Character Set](en/24-basic-regular-expressions/02-character-set.md) | [Класи символів](uk/24-basic-regular-expressions/02-character-set.md) |
| 3 | [Anchors](en/24-basic-regular-expressions/03-anchors.md) | [Якорі](uk/24-basic-regular-expressions/03-anchors.md) |
| 4 | [Word Boundary](en/24-basic-regular-expressions/04-word-boundary.md) | [Межа слова](uk/24-basic-regular-expressions/04-word-boundary.md) |

<a id="25"></a>

## 25. Quantifiers · Квантифікатори

| # | English | Українська |
|---|---|---|
| 1 | [Quantifiers](en/25-quantifiers/01-quantifiers.md) | [Квантифікатори](uk/25-quantifiers/01-quantifiers.md) |
| 2 | [Greedy Quantifiers](en/25-quantifiers/02-greedy-quantifiers.md) | [Жадібні квантифікатори](uk/25-quantifiers/02-greedy-quantifiers.md) |
| 3 | [Non-Greedy Quantifiers](en/25-quantifiers/03-non-greedy-quantifiers.md) | [Нежадібні квантифікатори](uk/25-quantifiers/03-non-greedy-quantifiers.md) |

<a id="26"></a>

## 26. Sets & Ranges · Набори та діапазони символів

| # | English | Українська |
|---|---|---|
| 1 | [Sets & Ranges](en/26-sets-and-ranges/01-sets-and-ranges.md) | [Набори та діапазони](uk/26-sets-and-ranges/01-sets-and-ranges.md) |

<a id="27"></a>

## 27. Groupings · Групування

| # | English | Українська |
|---|---|---|
| 1 | [Capturing Groups](en/27-groupings/01-capturing-groups.md) | [Групи захоплення](uk/27-groupings/01-capturing-groups.md) |
| 2 | [Backreferences](en/27-groupings/02-backreferences.md) | [Зворотні посилання](uk/27-groupings/02-backreferences.md) |
| 3 | [Alternation](en/27-groupings/03-alternation.md) | [Альтернація](uk/27-groupings/03-alternation.md) |
| 4 | [Non-capturing Groups](en/27-groupings/04-non-capturing-groups.md) | [Групи без захоплення](uk/27-groupings/04-non-capturing-groups.md) |

<a id="28"></a>

## 28. Look Around · Перегляд уперед і назад

| # | English | Українська |
|---|---|---|
| 1 | [Lookahead](en/28-look-around/01-lookahead.md) | [Перегляд уперед](uk/28-look-around/01-lookahead.md) |
| 2 | [Lookbehind](en/28-look-around/02-lookbehind.md) | [Перегляд назад](uk/28-look-around/02-lookbehind.md) |

<a id="29"></a>

## 29. Regex Functions · Функції регулярних виразів

| # | English | Українська |
|---|---|---|
| 1 | [findall()](en/29-regex-functions/01-findall.md) | [findall()](uk/29-regex-functions/01-findall.md) |
| 2 | [fullmatch()](en/29-regex-functions/02-fullmatch.md) | [fullmatch()](uk/29-regex-functions/02-fullmatch.md) |
| 3 | [finditer()](en/29-regex-functions/03-finditer.md) | [finditer()](uk/29-regex-functions/03-finditer.md) |
| 4 | [match()](en/29-regex-functions/04-match.md) | [match()](uk/29-regex-functions/04-match.md) |
| 5 | [sub()](en/29-regex-functions/05-sub.md) | [sub()](uk/29-regex-functions/05-sub.md) |
| 6 | [search()](en/29-regex-functions/06-search.md) | [search()](uk/29-regex-functions/06-search.md) |
| 7 | [split()](en/29-regex-functions/07-split.md) | [split()](uk/29-regex-functions/07-split.md) |
| 8 | [Regex Flags](en/29-regex-functions/08-regex-flags.md) | [Прапорці регулярних виразів](uk/29-regex-functions/08-regex-flags.md) |
| 9 | [Regex Cheat Sheet](en/29-regex-functions/09-regex-cheat-sheet.md) | [Шпаргалка з регулярних виразів](uk/29-regex-functions/09-regex-cheat-sheet.md) |

<a id="30"></a>

## 30. asyncio — Asynchronous I/O · asyncio — асинхронний ввід-вивід

| # | English | Українська |
|---|---|---|
| 1 | [asyncio](en/30-asyncio/01-asyncio.md) | [asyncio](uk/30-asyncio/01-asyncio.md) |

<a id="31"></a>

## 31. Design Patterns · Патерни проєктування

| # | English | Українська |
|---|---|---|
| 1 | [Factory Method](en/31-design-patterns/01-factory-method.md) | [Фабричний метод](uk/31-design-patterns/01-factory-method.md) |
| 2 | [Abstract Factory](en/31-design-patterns/02-abstract-factory.md) | [Абстрактна фабрика](uk/31-design-patterns/02-abstract-factory.md) |
| 3 | [Adapter](en/31-design-patterns/03-adapter.md) | [Адаптер](uk/31-design-patterns/03-adapter.md) |
| 4 | [Bridge](en/31-design-patterns/04-bridge.md) | [Міст](uk/31-design-patterns/04-bridge.md) |
| 5 | [Mediator](en/31-design-patterns/05-mediator.md) | [Посередник](uk/31-design-patterns/05-mediator.md) |
| 6 | [Observer](en/31-design-patterns/06-observer.md) | [Спостерігач](uk/31-design-patterns/06-observer.md) |
| 7 | [Strategy/State](en/31-design-patterns/07-strategy-state.md) | [Стратегія/Стан](uk/31-design-patterns/07-strategy-state.md) |
| 8 | [Template Method](en/31-design-patterns/08-template-method.md) | [Шаблонний метод](uk/31-design-patterns/08-template-method.md) |
| 9 | [Proxy/Decorator](en/31-design-patterns/09-proxy-decorator.md) | [Замісник/Декоратор](uk/31-design-patterns/09-proxy-decorator.md) |
| 10 | [Visitor](en/31-design-patterns/10-visitor.md) | [Відвідувач](uk/31-design-patterns/10-visitor.md) |

<a id="32"></a>

## 32. NumPy · NumPy

| # | English | Українська |
|---|---|---|
| 1 | [NumPy](en/32-numpy/01-numpy.md) | [NumPy](uk/32-numpy/01-numpy.md) |
