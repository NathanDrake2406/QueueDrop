using FluentAssertions;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Tests;

public class QueueTests
{
    private static readonly Guid BusinessId = Guid.NewGuid();
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

    private static Queue CreateQueue(bool isActive = true)
    {
        var queue = Queue.Create(BusinessId, "Test Queue", "test-queue", Now);
        if (!isActive) queue.Deactivate();
        return queue;
    }

    public class CreateTests
    {
        [Fact]
        public void Create_WithValidData_ShouldCreateQueue()
        {
            // Act
            var queue = Queue.Create(BusinessId, "My Queue", "my-queue", Now);

            // Assert
            queue.Id.Should().NotBeEmpty();
            queue.Name.Should().Be("My Queue");
            queue.Slug.Should().Be("my-queue");
            queue.BusinessId.Should().Be(BusinessId);
            queue.IsActive.Should().BeTrue();
            queue.IsPaused.Should().BeFalse();
            queue.CreatedAt.Should().Be(Now);
            queue.Settings.Should().NotBeNull();
            queue.Customers.Should().BeEmpty();
        }

        [Fact]
        public void Create_ShouldNormalizeSlug()
        {
            // Act
            var queue = Queue.Create(BusinessId, "My Queue", "  My-QUEUE  ", Now);

            // Assert
            queue.Slug.Should().Be("my-queue");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_WithInvalidName_ShouldThrow(string? name)
        {
            // Act
            var act = () => Queue.Create(BusinessId, name!, "test-queue", Now);

            // Assert
            act.Should().Throw<ArgumentException>();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_WithInvalidSlug_ShouldThrow(string? slug)
        {
            // Act
            var act = () => Queue.Create(BusinessId, "Test Queue", slug!, Now);

            // Assert
            act.Should().Throw<ArgumentException>();
        }
    }

    public class AddCustomerTests
    {
        [Fact]
        public void AddCustomer_WhenActive_ShouldAddCustomer()
        {
            // Arrange
            var queue = CreateQueue();
            var joinTime = Now.AddMinutes(1);

            // Act
            var result = queue.AddCustomer("Alice", joinTime);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Value.Name.Should().Be("Alice");
            result.Value.Status.Should().Be(CustomerStatus.Waiting);
            result.Value.Token.Should().NotBeNullOrEmpty();
            result.Value.JoinedAt.Should().Be(joinTime);
            queue.Customers.Should().HaveCount(1);
        }

        [Fact]
        public void AddCustomer_ShouldTrimName()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var result = queue.AddCustomer("  Bob  ", Now);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Value.Name.Should().Be("Bob");
        }

        [Fact]
        public void AddCustomer_WhenInactive_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue(isActive: false);

            // Act
            var result = queue.AddCustomer("Alice", Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Queue.NotActive");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void AddCustomer_WithInvalidName_ShouldFail(string? name)
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var result = queue.AddCustomer(name!, Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Customer.InvalidName");
        }

        [Fact]
        public void AddCustomer_WithNameTooLong_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();
            var longName = new string('a', 101);

            // Act
            var result = queue.AddCustomer(longName, Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Customer.InvalidName");
        }

        [Fact]
        public void AddCustomer_ShouldAssignSequentialJoinPositions()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var alice = queue.AddCustomer("Alice", Now).Value;
            var bob = queue.AddCustomer("Bob", Now.AddSeconds(1)).Value;
            var charlie = queue.AddCustomer("Charlie", Now.AddSeconds(2)).Value;

            // Assert
            alice.JoinPosition.Should().Be(1);
            bob.JoinPosition.Should().Be(2);
            charlie.JoinPosition.Should().Be(3);
        }

        [Fact]
        public void AddCustomer_WhenQueueFull_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();
            queue.UpdateSettings(QueueSettings.Default with { MaxQueueSize = 2 });
            queue.AddCustomer("Alice", Now);
            queue.AddCustomer("Bob", Now);

            // Act
            var result = queue.AddCustomer("Charlie", Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Queue.Full");
        }

        [Fact]
        public void AddCustomer_ShouldGenerateUniqueTokens()
        {
            // Arrange
            var queue = CreateQueue();
            var tokens = new HashSet<string>();

            // Act
            for (int i = 0; i < 100; i++)
            {
                var result = queue.AddCustomer($"Customer{i}", Now.AddSeconds(i));
                tokens.Add(result.Value.Token);
            }

            // Assert
            tokens.Should().HaveCount(100, "all tokens should be unique");
        }
    }

    public class CallNextTests
    {
        [Fact]
        public void CallNext_WithWaitingCustomers_ShouldCallOldest()
        {
            // Arrange
            var queue = CreateQueue();
            queue.AddCustomer("Alice", Now);
            queue.AddCustomer("Bob", Now.AddMinutes(1));
            var callTime = Now.AddMinutes(5);

            // Act
            var result = queue.CallNext(callTime);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Value.Name.Should().Be("Alice");
            result.Value.Status.Should().Be(CustomerStatus.Called);
            result.Value.CalledAt.Should().Be(callTime);
        }

        [Fact]
        public void CallNext_WhenEmpty_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var result = queue.CallNext(Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Queue.Empty");
        }

        [Fact]
        public void CallNext_WhenInactive_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue(isActive: false);

            // Act
            var result = queue.CallNext(Now);

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Queue.NotActive");
        }

        [Fact]
        public void CallNext_ShouldSkipAlreadyCalledCustomers()
        {
            // Arrange
            var queue = CreateQueue();
            queue.AddCustomer("Alice", Now);
            queue.AddCustomer("Bob", Now.AddMinutes(1));
            queue.CallNext(Now.AddMinutes(2)); // Call Alice

            // Act
            var result = queue.CallNext(Now.AddMinutes(3));

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Value.Name.Should().Be("Bob");
        }

        [Fact]
        public void CallNext_WhenAllCalled_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();
            queue.AddCustomer("Alice", Now);
            queue.CallNext(Now.AddMinutes(1));

            // Act
            var result = queue.CallNext(Now.AddMinutes(2));

            // Assert
            result.IsFailure.Should().BeTrue();
            result.Error.Code.Should().Be("Queue.Empty");
        }
    }

    public class PositionTests
    {
        [Fact]
        public void GetCustomerPosition_ShouldReturnCorrectPosition()
        {
            // Arrange
            var queue = CreateQueue();
            var alice = queue.AddCustomer("Alice", Now).Value;
            var bob = queue.AddCustomer("Bob", Now.AddMinutes(1)).Value;
            var charlie = queue.AddCustomer("Charlie", Now.AddMinutes(2)).Value;

            // Assert
            queue.GetCustomerPosition(alice.Id).Should().Be(1);
            queue.GetCustomerPosition(bob.Id).Should().Be(2);
            queue.GetCustomerPosition(charlie.Id).Should().Be(3);
        }

        [Fact]
        public void GetCustomerPosition_AfterCallNext_ShouldUpdatePositions()
        {
            // Arrange
            var queue = CreateQueue();
            var alice = queue.AddCustomer("Alice", Now).Value;
            var bob = queue.AddCustomer("Bob", Now.AddMinutes(1)).Value;
            var charlie = queue.AddCustomer("Charlie", Now.AddMinutes(2)).Value;

            // Act
            queue.CallNext(Now.AddMinutes(5)); // Call Alice

            // Assert
            queue.GetCustomerPosition(alice.Id).Should().BeNull("called customer has no position");
            queue.GetCustomerPosition(bob.Id).Should().Be(1);
            queue.GetCustomerPosition(charlie.Id).Should().Be(2);
        }

        [Fact]
        public void GetCustomerPosition_ForNonExistentCustomer_ShouldReturnNull()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var position = queue.GetCustomerPosition(Guid.NewGuid());

            // Assert
            position.Should().BeNull();
        }

        [Fact]
        public void GetUpdatedPositions_ShouldReturnAllWaitingCustomers()
        {
            // Arrange
            var queue = CreateQueue();
            var alice = queue.AddCustomer("Alice", Now).Value;
            var bob = queue.AddCustomer("Bob", Now.AddMinutes(1)).Value;
            var charlie = queue.AddCustomer("Charlie", Now.AddMinutes(2)).Value;
            queue.CallNext(Now.AddMinutes(5)); // Call Alice

            // Act
            var positions = queue.GetUpdatedPositions();

            // Assert
            positions.Should().HaveCount(2);
            positions.Should().Contain((bob.Id, 1));
            positions.Should().Contain((charlie.Id, 2));
        }

        [Fact]
        public void GetWaitingCount_ShouldReturnCorrectCount()
        {
            // Arrange
            var queue = CreateQueue();
            queue.AddCustomer("Alice", Now);
            queue.AddCustomer("Bob", Now.AddMinutes(1));
            queue.AddCustomer("Charlie", Now.AddMinutes(2));
            queue.CallNext(Now.AddMinutes(5)); // Call Alice

            // Act
            var count = queue.GetWaitingCount();

            // Assert
            count.Should().Be(2);
        }
    }

    public class CustomerStatusTests
    {
        [Fact]
        public void MarkCustomerServed_WhenCalled_ShouldSucceed()
        {
            // Arrange
            var queue = CreateQueue();
            var customer = queue.AddCustomer("Alice", Now).Value;
            queue.CallNext(Now.AddMinutes(1));
            var servedTime = Now.AddMinutes(5);

            // Act
            var result = queue.MarkCustomerServed(customer.Id, servedTime);

            // Assert
            result.IsSuccess.Should().BeTrue();
            customer.Status.Should().Be(CustomerStatus.Served);
            customer.ServedAt.Should().Be(servedTime);
        }

        [Fact]
        public void MarkCustomerServed_WhenWaiting_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();
            var customer = queue.AddCustomer("Alice", Now).Value;

            // Act
            var result = queue.MarkCustomerServed(customer.Id, Now);

            // Assert
            result.IsFailure.Should().BeTrue();
        }

        [Fact]
        public void MarkCustomerNoShow_WhenCalled_ShouldSucceed()
        {
            // Arrange
            var queue = CreateQueue();
            var customer = queue.AddCustomer("Alice", Now).Value;
            queue.CallNext(Now.AddMinutes(1));

            // Act
            var result = queue.MarkCustomerNoShow(customer.Id, Now.AddMinutes(10));

            // Assert
            result.IsSuccess.Should().BeTrue();
            customer.Status.Should().Be(CustomerStatus.NoShow);
        }

        [Fact]
        public void RemoveCustomer_WhenWaiting_ShouldSucceed()
        {
            // Arrange
            var queue = CreateQueue();
            var customer = queue.AddCustomer("Alice", Now).Value;

            // Act
            var result = queue.RemoveCustomer(customer.Id);

            // Assert
            result.IsSuccess.Should().BeTrue();
            customer.Status.Should().Be(CustomerStatus.Removed);
        }

        [Fact]
        public void RemoveCustomer_WhenServed_ShouldFail()
        {
            // Arrange
            var queue = CreateQueue();
            var customer = queue.AddCustomer("Alice", Now).Value;
            queue.CallNext(Now.AddMinutes(1));
            queue.MarkCustomerServed(customer.Id, Now.AddMinutes(5));

            // Act
            var result = queue.RemoveCustomer(customer.Id);

            // Assert
            result.IsFailure.Should().BeTrue();
        }

        [Fact]
        public void GetServedCount_ShouldCountRecentlyServed()
        {
            // Arrange
            var queue = CreateQueue();
            var baseTime = DateTimeOffset.UtcNow;

            // Add and serve customers at different times
            queue.AddCustomer("Alice", baseTime);
            queue.AddCustomer("Bob", baseTime.AddMinutes(1));
            queue.AddCustomer("Charlie", baseTime.AddMinutes(2));

            queue.CallNext(baseTime.AddMinutes(10));
            queue.MarkCustomerServed(queue.Customers[0].Id, baseTime.AddMinutes(15));

            queue.CallNext(baseTime.AddMinutes(20));
            queue.MarkCustomerServed(queue.Customers[1].Id, baseTime.AddMinutes(25));

            // Act
            var countLast30 = queue.GetServedCount(baseTime);
            var countLast10 = queue.GetServedCount(baseTime.AddMinutes(20));

            // Assert
            countLast30.Should().Be(2);
            countLast10.Should().Be(1);
        }
    }

    public class QueueStateTests
    {
        [Fact]
        public void Activate_ShouldSetIsActiveTrue()
        {
            // Arrange
            var queue = CreateQueue(isActive: false);

            // Act
            queue.Activate();

            // Assert
            queue.IsActive.Should().BeTrue();
        }

        [Fact]
        public void Deactivate_ShouldSetIsActiveFalse()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            queue.Deactivate();

            // Assert
            queue.IsActive.Should().BeFalse();
        }

        [Fact]
        public void Pause_ShouldSetIsPausedTrue()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            queue.Pause();

            // Assert
            queue.IsPaused.Should().BeTrue();
        }

        [Fact]
        public void Resume_ShouldSetIsPausedFalse()
        {
            // Arrange
            var queue = CreateQueue();
            queue.Pause();

            // Act
            queue.Resume();

            // Assert
            queue.IsPaused.Should().BeFalse();
        }

        [Fact]
        public void Rename_WithValidName_ShouldUpdateName()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            queue.Rename("New Name");

            // Assert
            queue.Name.Should().Be("New Name");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Rename_WithInvalidName_ShouldThrow(string? name)
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var act = () => queue.Rename(name!);

            // Assert
            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void UpdateSlug_WithValidSlug_ShouldUpdateSlug()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            queue.UpdateSlug("new-slug");

            // Assert
            queue.Slug.Should().Be("new-slug");
        }

        [Fact]
        public void UpdateSlug_ShouldNormalizeSlug()
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            queue.UpdateSlug("  NEW-SLUG  ");

            // Assert
            queue.Slug.Should().Be("new-slug");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void UpdateSlug_WithInvalidSlug_ShouldThrow(string? slug)
        {
            // Arrange
            var queue = CreateQueue();

            // Act
            var act = () => queue.UpdateSlug(slug!);

            // Assert
            act.Should().Throw<ArgumentException>();
        }
    }
}
