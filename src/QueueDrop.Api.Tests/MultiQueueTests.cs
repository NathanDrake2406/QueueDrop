using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests;

/// <summary>
/// Integration tests for multi-queue functionality.
/// </summary>
public class MultiQueueTests : IntegrationTestBase
{
    private static readonly Guid SecondQueueId = new("33333333-3333-3333-3333-333333333333");
    private const string SecondQueueName = "Takeout";
    private const string SecondQueueSlug = "takeout";

    protected override async Task SeedAdditionalDataAsync(TestAppDbContext db)
    {
        // Add a second queue to test multi-queue scenarios
        var queue = Queue.Create(
            TestBusinessId,
            SecondQueueName,
            SecondQueueSlug,
            DateTimeOffset.UtcNow);

        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(queue, SecondQueueId);
        db.Queues.Add(queue);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    public class GetBusinessQueuesTests : MultiQueueTests
    {
        [Fact]
        public async Task GetBusinessQueues_ShouldReturnAllActiveQueues()
        {
            // Act
            var response = await Client.GetAsync($"/api/business/{TestBusinessSlug}/queues");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content.ReadFromJsonAsync<GetBusinessQueuesResponse>();
            result.Should().NotBeNull();
            result!.BusinessId.Should().Be(TestBusinessId);
            result.BusinessName.Should().Be(TestBusinessName);
            result.Queues.Should().HaveCount(2);

            // Verify queue data
            result.Queues.Should().Contain(q => q.Name == TestQueueName && q.Slug == "test-queue");
            result.Queues.Should().Contain(q => q.Name == SecondQueueName && q.Slug == SecondQueueSlug);
        }

        [Fact]
        public async Task GetBusinessQueues_WithNonExistentBusiness_ShouldReturn404()
        {
            // Act
            var response = await Client.GetAsync("/api/business/nonexistent-business/queues");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task GetBusinessQueues_ShouldReturnWaitingCounts()
        {
            // Arrange - add some customers to the first queue
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/test-queue", new { name = "Alice" });
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/test-queue", new { name = "Bob" });

            // Act
            var response = await Client.GetAsync($"/api/business/{TestBusinessSlug}/queues");

            // Assert
            var result = await response.Content.ReadFromJsonAsync<GetBusinessQueuesResponse>();
            var firstQueue = result!.Queues.First(q => q.Slug == "test-queue");
            firstQueue.WaitingCount.Should().Be(2);

            var secondQueue = result.Queues.First(q => q.Slug == SecondQueueSlug);
            secondQueue.WaitingCount.Should().Be(0);
        }
    }

    public class JoinQueueWithSlugTests : MultiQueueTests
    {
        [Fact]
        public async Task JoinQueue_WithValidQueueSlug_ShouldJoinSpecificQueue()
        {
            // Act
            var response = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/{SecondQueueSlug}",
                new { name = "Alice" });

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.Created);

            var result = await response.Content.ReadFromJsonAsync<JoinQueueWithSlugResponse>();
            result.Should().NotBeNull();
            result!.QueueName.Should().Be(SecondQueueName);
            result.QueueSlug.Should().Be(SecondQueueSlug);
            result.Position.Should().Be(1);
        }

        [Fact]
        public async Task JoinQueue_WithNonExistentQueueSlug_ShouldReturn404()
        {
            // Act
            var response = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/nonexistent-queue",
                new { name = "Alice" });

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task JoinQueue_WithoutSlug_WhenMultipleQueues_ShouldReturn400WithOptions()
        {
            // Act
            var response = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}",
                new { name = "Alice" });

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

            var result = await response.Content.ReadFromJsonAsync<MultipleQueuesResponse>();
            result.Should().NotBeNull();
            result!.Message.Should().Contain("Multiple queues available");
            result.Queues.Should().HaveCount(2);
            result.Queues.Should().Contain(q => q.Slug == "test-queue");
            result.Queues.Should().Contain(q => q.Slug == SecondQueueSlug);
        }

        [Fact]
        public async Task JoinQueue_EachQueueMaintainsSeparatePositions()
        {
            // Join first queue
            var response1 = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/test-queue",
                new { name = "Alice" });
            var result1 = await response1.Content.ReadFromJsonAsync<JoinQueueWithSlugResponse>();

            // Join second queue
            var response2 = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/{SecondQueueSlug}",
                new { name = "Bob" });
            var result2 = await response2.Content.ReadFromJsonAsync<JoinQueueWithSlugResponse>();

            // Join first queue again
            var response3 = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/test-queue",
                new { name = "Charlie" });
            var result3 = await response3.Content.ReadFromJsonAsync<JoinQueueWithSlugResponse>();

            // Assert - each queue has independent positions
            result1!.Position.Should().Be(1);
            result2!.Position.Should().Be(1); // First in second queue
            result3!.Position.Should().Be(2); // Second in first queue
        }
    }

    public class GetQueueByBusinessWithSlugTests : MultiQueueTests
    {
        [Fact]
        public async Task GetQueueByBusiness_ShouldIncludeQueueSlug()
        {
            // Act
            var response = await Client.GetAsync($"/api/business/{TestBusinessSlug}/queue");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content.ReadFromJsonAsync<GetQueueByBusinessResponse>();
            result.Should().NotBeNull();
            result!.QueueSlug.Should().Be("test-queue");
        }
    }

    private record GetBusinessQueuesResponse(
        Guid BusinessId,
        string BusinessName,
        List<QueueDto> Queues);

    private record QueueDto(
        Guid QueueId,
        string Name,
        string Slug,
        int WaitingCount,
        int EstimatedWaitMinutes);

    private record JoinQueueWithSlugResponse(
        string Token,
        int Position,
        string QueueName,
        string QueueSlug);

    private record MultipleQueuesResponse(
        string Message,
        List<QueueOptionDto> Queues);

    private record QueueOptionDto(
        string Name,
        string Slug,
        int WaitingCount,
        int EstimatedWaitMinutes);

    private record GetQueueByBusinessResponse(
        Guid QueueId,
        string QueueName,
        string QueueSlug,
        Guid BusinessId,
        string BusinessName);

    public class CustomerManagementOnSecondQueueTests : MultiQueueTests
    {
        [Fact]
        public async Task RemoveCustomer_FromSecondQueue_ShouldSucceed()
        {
            // Arrange - join second queue
            var joinResponse = await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/{SecondQueueSlug}",
                new { name = "Alice" });
            var joinResult = await joinResponse.Content.ReadFromJsonAsync<JoinQueueWithSlugResponse>();

            // Get customer ID from queue
            var customersResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var customersResult = await customersResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var customerId = customersResult!.Customers.First().Id;

            // Act - remove from second queue
            var removeResponse = await Client.DeleteAsync($"/api/queues/{SecondQueueId}/customers/{customerId}");

            // Assert
            removeResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify customer is gone
            var verifyResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            verifyResult!.Customers.Should().BeEmpty();
        }

        [Fact]
        public async Task RemoveCustomer_FromWrongQueue_ShouldReturn404()
        {
            // Arrange - join second queue
            await Client.PostAsJsonAsync(
                $"/api/join/{TestBusinessSlug}/{SecondQueueSlug}",
                new { name = "Alice" });

            // Get customer ID from second queue
            var customersResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var customersResult = await customersResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var customerId = customersResult!.Customers.First().Id;

            // Act - try to remove from FIRST queue (wrong queue)
            var removeResponse = await Client.DeleteAsync($"/api/queues/{TestQueueId}/customers/{customerId}");

            // Assert - should fail because customer is not in first queue
            removeResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task CallNext_OnSecondQueue_ShouldCallCorrectCustomer()
        {
            // Arrange - add customers to both queues
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/test-queue", new { name = "FirstQueue_Alice" });
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/{SecondQueueSlug}", new { name = "SecondQueue_Bob" });

            // Act - call next on second queue
            var callResponse = await Client.PostAsync($"/api/queues/{SecondQueueId}/call-next", null);

            // Assert
            callResponse.StatusCode.Should().Be(HttpStatusCode.OK);

            // Verify the correct customer was called
            var customersResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var customersResult = await customersResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var calledCustomer = customersResult!.Customers.First();
            calledCustomer.Name.Should().Be("SecondQueue_Bob");
            calledCustomer.Status.Should().Be("Called");

            // Verify first queue customer is still waiting
            var firstQueueResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
            var firstQueueResult = await firstQueueResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var waitingCustomer = firstQueueResult!.Customers.First();
            waitingCustomer.Name.Should().Be("FirstQueue_Alice");
            waitingCustomer.Status.Should().Be("Waiting");
        }

        [Fact]
        public async Task MarkServed_OnSecondQueue_ShouldSucceed()
        {
            // Arrange - join and call customer on second queue
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/{SecondQueueSlug}", new { name = "Alice" });
            await Client.PostAsync($"/api/queues/{SecondQueueId}/call-next", null);

            var customersResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var customersResult = await customersResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var customerId = customersResult!.Customers.First().Id;

            // Act
            var serveResponse = await Client.PostAsync($"/api/queues/{SecondQueueId}/customers/{customerId}/serve", null);

            // Assert
            serveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify customer is served (removed from active list)
            var verifyResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            verifyResult!.Customers.Should().BeEmpty();
        }

        [Fact]
        public async Task MarkNoShow_OnSecondQueue_ShouldSucceed()
        {
            // Arrange - join and call customer on second queue
            await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}/{SecondQueueSlug}", new { name = "Alice" });
            await Client.PostAsync($"/api/queues/{SecondQueueId}/call-next", null);

            var customersResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var customersResult = await customersResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            var customerId = customersResult!.Customers.First().Id;

            // Act
            var noShowResponse = await Client.PostAsync($"/api/queues/{SecondQueueId}/customers/{customerId}/no-show", null);

            // Assert
            noShowResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify customer is marked as no-show (removed from active list)
            var verifyResponse = await Client.GetAsync($"/api/queues/{SecondQueueId}/customers");
            var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<CustomersResponse>();
            verifyResult!.Customers.Should().BeEmpty();
        }
    }

    public class SeedDemoDataWithQueueIdTests : MultiQueueTests
    {
        [Fact]
        public async Task SeedDemoData_WithQueueId_ShouldSeedToSpecificQueue()
        {
            // Arrange - test business slug is "demo-shop", so seeding works
            var response = await Client.PostAsync($"/api/demo/seed?queueId={SecondQueueId}", null);

            // Should successfully seed to the specified queue
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content.ReadFromJsonAsync<SeedResponse>();
            result.Should().NotBeNull();
            result!.CustomersAdded.Should().BeGreaterThan(0);
        }

        private record SeedResponse(int CustomersAdded, string Message);
    }

    private record CustomersResponse(
        List<CustomerDto> Customers,
        QueueInfoDto QueueInfo);

    private record CustomerDto(
        Guid Id,
        string Name,
        string Token,
        string Status,
        int? Position,
        DateTimeOffset JoinedAt);

    private record QueueInfoDto(
        string Name,
        bool IsActive,
        bool IsPaused,
        int WaitingCount,
        int CalledCount);
}
