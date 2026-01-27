namespace QueueDrop.Domain.Common;

/// <summary>
/// Represents the outcome of an operation that can fail with an expected error.
/// Use for domain validation failures and business rule violations.
/// Throw exceptions only for bugs and invariant corruption.
/// </summary>
public readonly struct Result<T>
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T value)
    {
        _value = value;
        _error = null;
        IsSuccess = true;
    }

    private Result(Error error)
    {
        _value = default;
        _error = error;
        IsSuccess = false;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException($"Cannot access Value on failed Result. Error: {_error}");

    public Error Error => !IsSuccess
        ? _error!
        : throw new InvalidOperationException("Cannot access Error on successful Result.");

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(Error error) => new(error);
    public static Result<T> Failure(string code, string message) => new(new Error(code, message));

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure(error);

    public TResult Match<TResult>(Func<T, TResult> onSuccess, Func<Error, TResult> onFailure)
        => IsSuccess ? onSuccess(_value!) : onFailure(_error!);

    public Result<TNew> Map<TNew>(Func<T, TNew> mapper)
        => IsSuccess ? Result<TNew>.Success(mapper(_value!)) : Result<TNew>.Failure(_error!);

    public Result<TNew> Bind<TNew>(Func<T, Result<TNew>> binder)
        => IsSuccess ? binder(_value!) : Result<TNew>.Failure(_error!);
}

/// <summary>
/// Represents a non-generic result for operations that don't return a value.
/// </summary>
public readonly struct Result
{
    private readonly Error? _error;

    private Result(bool isSuccess, Error? error)
    {
        IsSuccess = isSuccess;
        _error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    public Error Error => !IsSuccess
        ? _error!
        : throw new InvalidOperationException("Cannot access Error on successful Result.");

    public static Result Success() => new(true, null);
    public static Result Failure(Error error) => new(false, error);
    public static Result Failure(string code, string message) => new(false, new Error(code, message));

    public static implicit operator Result(Error error) => Failure(error);
}

/// <summary>
/// Represents an expected error with a code for programmatic handling and a message for display.
/// </summary>
public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);

    public override string ToString() => $"{Code}: {Message}";
}

/// <summary>
/// Common domain errors.
/// </summary>
public static class DomainErrors
{
    public static class Queue
    {
        public static Error NotFound(Guid id) => new("Queue.NotFound", $"Queue with ID '{id}' was not found.");
        public static Error NotActive => new("Queue.NotActive", "Queue is not currently active.");
        public static Error Empty => new("Queue.Empty", "No customers waiting in queue.");
        public static Error CustomerNotFound(Guid customerId) => new("Queue.CustomerNotFound", $"Customer '{customerId}' not found in queue.");
    }

    public static class Customer
    {
        public static Error NotFound(string token) => new("Customer.NotFound", $"Customer with token '{token}' was not found.");
        public static Error InvalidName => new("Customer.InvalidName", "Customer name is required and must be between 1 and 100 characters.");
        public static Error AlreadyCalled => new("Customer.AlreadyCalled", "Customer has already been called.");
        public static Error NotWaiting => new("Customer.NotWaiting", "Customer is not in waiting status.");
    }

    public static class Business
    {
        public static Error NotFound(string slug) => new("Business.NotFound", $"Business '{slug}' was not found.");
        public static Error NoActiveQueue => new("Business.NoActiveQueue", "Business has no active queue.");
    }
}
