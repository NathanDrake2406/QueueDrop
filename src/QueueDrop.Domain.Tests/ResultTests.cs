using FluentAssertions;
using QueueDrop.Domain.Common;

namespace QueueDrop.Domain.Tests;

public class ResultTests
{
    [Fact]
    public void Success_ShouldCreateSuccessfulResult()
    {
        // Act
        var result = Result<int>.Success(42);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Value.Should().Be(42);
    }

    [Fact]
    public void Failure_ShouldCreateFailedResult()
    {
        // Arrange
        var error = new Error("TEST", "Test error message");

        // Act
        var result = Result<int>.Failure(error);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(error);
    }

    [Fact]
    public void Value_WhenFailure_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var result = Result<int>.Failure("CODE", "Message");

        // Act
        var act = () => result.Value;

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot access Value on failed Result*");
    }

    [Fact]
    public void Error_WhenSuccess_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var result = Result<int>.Success(42);

        // Act
        var act = () => result.Error;

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot access Error on successful Result*");
    }

    [Fact]
    public void ImplicitConversion_FromValue_ShouldCreateSuccess()
    {
        // Act
        Result<string> result = "hello";

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("hello");
    }

    [Fact]
    public void ImplicitConversion_FromError_ShouldCreateFailure()
    {
        // Arrange
        var error = new Error("CODE", "Message");

        // Act
        Result<string> result = error;

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(error);
    }

    [Fact]
    public void Match_WhenSuccess_ShouldCallOnSuccess()
    {
        // Arrange
        var result = Result<int>.Success(10);

        // Act
        var output = result.Match(
            onSuccess: v => $"Value: {v}",
            onFailure: e => $"Error: {e.Code}");

        // Assert
        output.Should().Be("Value: 10");
    }

    [Fact]
    public void Match_WhenFailure_ShouldCallOnFailure()
    {
        // Arrange
        var result = Result<int>.Failure("ERR", "Failed");

        // Act
        var output = result.Match(
            onSuccess: v => $"Value: {v}",
            onFailure: e => $"Error: {e.Code}");

        // Assert
        output.Should().Be("Error: ERR");
    }

    [Fact]
    public void Map_WhenSuccess_ShouldTransformValue()
    {
        // Arrange
        var result = Result<int>.Success(5);

        // Act
        var mapped = result.Map(x => x * 2);

        // Assert
        mapped.IsSuccess.Should().BeTrue();
        mapped.Value.Should().Be(10);
    }

    [Fact]
    public void Map_WhenFailure_ShouldPropagateError()
    {
        // Arrange
        var error = new Error("ERR", "Original error");
        var result = Result<int>.Failure(error);

        // Act
        var mapped = result.Map(x => x * 2);

        // Assert
        mapped.IsFailure.Should().BeTrue();
        mapped.Error.Should().Be(error);
    }

    [Fact]
    public void Bind_WhenSuccess_ShouldChainOperations()
    {
        // Arrange
        var result = Result<int>.Success(10);

        // Act
        var bound = result.Bind(x =>
            x > 5
                ? Result<string>.Success($"Large: {x}")
                : Result<string>.Failure("TOO_SMALL", "Value too small"));

        // Assert
        bound.IsSuccess.Should().BeTrue();
        bound.Value.Should().Be("Large: 10");
    }

    [Fact]
    public void Bind_WhenFirstFailure_ShouldShortCircuit()
    {
        // Arrange
        var error = new Error("FIRST", "First error");
        var result = Result<int>.Failure(error);

        // Act
        var bound = result.Bind(x => Result<string>.Success($"Value: {x}"));

        // Assert
        bound.IsFailure.Should().BeTrue();
        bound.Error.Code.Should().Be("FIRST");
    }

    [Fact]
    public void NonGenericResult_Success_ShouldWork()
    {
        // Act
        var result = Result.Success();

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
    }

    [Fact]
    public void NonGenericResult_Failure_ShouldWork()
    {
        // Act
        var result = Result.Failure("CODE", "Message");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("CODE");
    }
}
